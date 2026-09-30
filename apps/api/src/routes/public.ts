import type { Request } from 'express';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { logActivity } from '../lib/activity';
import { config } from '../lib/config';
import { gone, HttpError, notFound, unauthorized } from '../lib/errors';
import { LINK_STATE_MESSAGE, linkState } from '../lib/links';
import { verifyPassword } from '../lib/password';
import { prisma } from '../lib/prisma';
import { limiter } from '../lib/rate-limiter';
import { id, parse } from '../lib/validate';
import { sendStoredFile } from './drive';

/**
 * Routes publiques des liens temporaires : aucune session, seulement le
 * jeton du lien (et, s'il est protégé, un jeton de déverrouillage obtenu
 * avec le mot de passe).
 */
export const publicRouter = Router();

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'Lien invalide');

async function findLink(rawToken: unknown) {
  const token = parse(tokenSchema, rawToken);
  const link = await prisma.link.findUnique({
    where: { tokenHash: createHash('sha256').update(token).digest('hex') },
    include: {
      folder: { select: { id: true, name: true, ownerId: true } },
      file: true,
      createdBy: { select: { name: true } },
    },
  });
  if (!link) throw notFound('Ce lien n’existe pas ou plus');
  return link;
}

type FoundLink = Awaited<ReturnType<typeof findLink>>;

function requireActive(link: FoundLink) {
  const state = linkState(link);
  if (state !== 'active') throw gone(LINK_STATE_MESSAGE[state]);
}

/** Un lien protégé exige un jeton de déverrouillage valide, émis pour ce lien précis. */
function isUnlocked(req: Request, link: FoundLink): boolean {
  if (!link.passwordHash) return true;
  const access = String(req.headers['x-link-access'] ?? req.query.access ?? '');
  if (!access) return false;
  try {
    const payload = jwt.verify(access, config.jwtSecret, { audience: 'link', algorithms: ['HS256'] }) as jwt.JwtPayload;
    return payload.sub === link.id;
  } catch {
    return false;
  }
}

/** Fichiers d'un dossier partagé par lien, avec leur chemin relatif (500 au plus). */
async function folderFiles(folderId: string) {
  return prisma.$queryRaw<{ id: string; name: string; size: bigint; mimeType: string; path: string }[]>`
    WITH RECURSIVE tree AS (
      SELECT id, name::text AS path, 0 AS depth FROM "Folder" WHERE id = ${folderId}
      UNION ALL
      SELECT f.id, t.path || ' / ' || f.name, t.depth + 1 FROM "Folder" f JOIN tree t ON f."parentId" = t.id WHERE t.depth < 32
    )
    SELECT fi.id, fi.name, fi.size, fi."mimeType", t.path
    FROM "File" fi JOIN tree t ON fi."folderId" = t.id
    ORDER BY t.path, fi.name
    LIMIT 500`;
}

publicRouter.get('/links/:token', async (req, res) => {
  const link = await findLink(req.params.token);
  const state = linkState(link);
  const unlocked = isUnlocked(req, link);
  const base = {
    state,
    message: state === 'active' ? null : LINK_STATE_MESSAGE[state],
    kind: link.folder ? 'folder' : 'file',
    name: link.folder?.name ?? link.file!.name,
    sharedBy: link.createdBy.name,
    label: link.label,
    expiresAt: link.expiresAt,
    protected: link.passwordHash !== null,
    unlocked,
    remainingDownloads: link.maxDownloads === null ? null : Math.max(0, link.maxDownloads - link.downloadCount),
  };
  // Tant que le lien est inactif ou verrouillé, on n'en révèle pas le contenu.
  if (state !== 'active' || !unlocked) {
    res.json(base);
    return;
  }
  const files = link.file
    ? [{ id: link.file.id, name: link.file.name, size: link.file.size, mimeType: link.file.mimeType, path: '', sha256: link.file.sha256 }]
    : await folderFiles(link.folder!.id);
  res.json({ ...base, files });
});

publicRouter.post('/links/:token/unlock', async (req, res) => {
  const link = await findLink(req.params.token);
  requireActive(link);
  if (!link.passwordHash) {
    res.json({ access: null });
    return;
  }
  // Frein à la force brute : 10 essais par lien et par adresse IP toutes les 10 minutes.
  if (!limiter.hit(`link:${link.id}:${req.ip}`, config.linkPasswordAttempts, 600_000)) {
    throw new HttpError(429, 'Trop d’essais. Réessayez dans quelques minutes.');
  }
  const { password } = parse(z.object({ password: z.string().min(1).max(128) }).strict(), req.body);
  if (!(await verifyPassword(password, link.passwordHash))) {
    await logActivity(req, {
      action: 'link.password_failed',
      ownerId: link.createdById,
      targetName: link.folder?.name ?? link.file!.name,
      targetType: 'link',
      details: `lien …${link.tokenHint}`,
    });
    throw unauthorized('Mot de passe incorrect');
  }
  const access = jwt.sign({}, config.jwtSecret, { subject: link.id, audience: 'link', expiresIn: config.linkUnlockTtl, algorithm: 'HS256' });
  res.json({ access });
});

publicRouter.get('/links/:token/download', async (req, res) => {
  const link = await findLink(req.params.token);
  requireActive(link);
  if (!isUnlocked(req, link)) throw unauthorized('Ce lien est protégé par un mot de passe');

  // Le fichier demandé doit être celui du lien, ou se trouver dans son dossier.
  const fileId = link.file ? link.file.id : parse(id, req.query.fileId);
  const file = link.file ?? (await prisma.file.findUnique({ where: { id: fileId } }));
  if (!file) throw notFound('Fichier introuvable');
  if (link.folder && !(await folderFiles(link.folder.id)).some((f) => f.id === file.id)) {
    throw notFound('Fichier introuvable');
  }

  // Décompte atomique : deux téléchargements simultanés ne peuvent pas
  // dépasser la limite, la condition est vérifiée par la base au moment d'écrire.
  const now = new Date();
  const { count } = await prisma.link.updateMany({
    where: {
      id: link.id,
      revokedAt: null,
      expiresAt: { gt: now },
      OR: [{ maxDownloads: null }, { downloadCount: { lt: link.maxDownloads ?? 0 } }],
    },
    data: { downloadCount: { increment: 1 } },
  });
  if (count === 0) throw gone(LINK_STATE_MESSAGE.exhausted);

  sendStoredFile(res, file, false);
  await logActivity(req, {
    action: 'link.download',
    ownerId: link.createdById,
    targetName: file.name,
    targetType: 'file',
    details: `via le lien …${link.tokenHint}`,
  });
});
