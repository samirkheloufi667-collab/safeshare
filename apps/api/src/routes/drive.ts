import type { Request } from 'express';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { createReadStream } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { atLeast, fileAccess, folderAccess, isInside, requireFile, requireFolder, type ChainItem, type Role } from '../lib/access';
import { logActivity } from '../lib/activity';
import { config } from '../lib/config';
import { badRequest, conflict, forbidden, HttpError, notFound, unauthorized } from '../lib/errors';
import {
  contentDisposition,
  moveToStorage,
  PREVIEWABLE,
  readHead,
  removeFromStorage,
  sanitizeName,
  sha256File,
  sniffMime,
  storagePath,
  uniqueName,
} from '../lib/files';
import { prisma } from '../lib/prisma';
import { id, name, parse } from '../lib/validate';
import { requireAuth, userOf } from '../middleware/auth';

export const driveRouter = Router();

/* ------------------------------------------------------------------ outils */

const folderSelect = {
  id: true,
  name: true,
  parentId: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { shares: true, children: true, files: true } },
} as const;

const fileSelect = {
  id: true,
  name: true,
  size: true,
  mimeType: true,
  sha256: true,
  folderId: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
  uploader: { select: { name: true } },
  _count: { select: { shares: true } },
} as const;

/** Nombre de liens encore actifs par élément, pour afficher une pastille « partagé ». */
async function activeLinkCounts(where: { folderId?: { in: string[] }; fileId?: { in: string[] } }) {
  const groups = await prisma.link.groupBy({
    by: where.folderId ? ['folderId'] : ['fileId'],
    where: { ...where, revokedAt: null, expiresAt: { gt: new Date() } },
    _count: { _all: true },
  });
  return new Map(groups.map((g) => [(g.folderId ?? g.fileId) as string, g._count._all]));
}

async function listContents(ownerId: string, parentId: string | null, role: Role) {
  const [folders, files] = await Promise.all([
    prisma.folder.findMany({ where: { ownerId, parentId }, select: folderSelect, orderBy: { name: 'asc' } }),
    prisma.file.findMany({ where: { ownerId, folderId: parentId }, select: fileSelect, orderBy: { name: 'asc' } }),
  ]);
  // Seul le propriétaire voit qui a accès : un invité ne voit pas les autres invités.
  const owner = role === 'OWNER';
  const [folderLinks, fileLinks] = owner
    ? await Promise.all([
        activeLinkCounts({ folderId: { in: folders.map((f) => f.id) } }),
        activeLinkCounts({ fileId: { in: files.map((f) => f.id) } }),
      ])
    : [new Map(), new Map()];
  return {
    folders: folders.map(({ _count, ...f }) => ({
      ...f,
      itemCount: _count.children + _count.files,
      shared: owner && (_count.shares > 0 || (folderLinks.get(f.id) ?? 0) > 0),
    })),
    files: files.map(({ _count, uploader, ...f }) => ({
      ...f,
      uploaderName: uploader.name,
      shared: owner && (_count.shares > 0 || (fileLinks.get(f.id) ?? 0) > 0),
    })),
  };
}

const crumbs = (chain: ChainItem[]) => chain.map(({ id, name }) => ({ id, name }));

/**
 * Déplacer ou supprimer un élément demande plus que de pouvoir le modifier :
 * être propriétaire, ou éditeur du dossier qui le contient. Un invité ne peut
 * donc pas supprimer ni sortir le dossier qu'on lui a partagé.
 */
async function requireParentEdit(userId: string, ownerId: string, parentId: string | null) {
  if (ownerId === userId) return;
  if (!parentId) throw forbidden('Seul le propriétaire peut déplacer ou supprimer cet élément');
  const parent = await folderAccess(userId, parentId);
  if (!parent || !atLeast(parent.role, 'EDITOR')) {
    throw forbidden('Seul le propriétaire peut déplacer ou supprimer cet élément');
  }
}

/** Dossier de destination d'un déplacement : modifiable par l'utilisateur, et dans l'arborescence du même propriétaire. */
async function resolveTarget(userId: string, ownerId: string, targetId: string | null) {
  if (targetId === null) {
    if (ownerId !== userId) throw forbidden('Seul le propriétaire peut ranger un élément à la racine');
    return null;
  }
  const target = await requireFolder(userId, targetId, 'EDITOR');
  if (target.folder.ownerId !== ownerId) {
    throw badRequest('Impossible de déplacer un élément vers l’espace d’un autre utilisateur');
  }
  return target.folder;
}

/* ------------------------------------------------------------ navigation */

driveRouter.use(requireAuth);

/** Racine de mon espace. */
driveRouter.get('/drive', async (req, res) => {
  const me = userOf(req);
  res.json({ folder: null, role: 'OWNER', breadcrumbs: [], ...(await listContents(me.id, null, 'OWNER')) });
});

driveRouter.get('/folders/:id', async (req, res) => {
  const me = userOf(req);
  const access = await requireFolder(me.id, parse(id, req.params.id), 'VIEWER');
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: access.folder.ownerId }, select: { name: true } });
  res.json({
    folder: { ...access.folder, ownerName: owner.name },
    role: access.role,
    breadcrumbs: crumbs(access.visible),
    ...(await listContents(access.folder.ownerId, access.folder.id, access.role)),
  });
});

/** Arborescence des dossiers modifiables : sert au choix de la destination d'un déplacement. */
driveRouter.get('/folders-tree', async (req, res) => {
  const me = userOf(req);
  const folders = await prisma.folder.findMany({
    where: { ownerId: me.id },
    select: { id: true, name: true, parentId: true },
    orderBy: { name: 'asc' },
  });
  res.json(folders);
});

driveRouter.get('/search', async (req, res) => {
  const me = userOf(req);
  const q = parse(z.string().trim().min(1).max(100), req.query.q);
  const [folders, files] = await Promise.all([
    prisma.folder.findMany({
      where: { ownerId: me.id, name: { contains: q, mode: 'insensitive' } },
      select: { id: true, name: true, parentId: true, updatedAt: true },
      take: 20,
    }),
    prisma.file.findMany({
      where: { ownerId: me.id, name: { contains: q, mode: 'insensitive' } },
      select: { id: true, name: true, size: true, mimeType: true, folderId: true, updatedAt: true },
      take: 30,
    }),
  ]);
  res.json({ folders, files });
});

/* ---------------------------------------------------------------- dossiers */

driveRouter.post('/folders', async (req, res) => {
  const me = userOf(req);
  const body = parse(z.object({ name, parentId: id.nullable().optional() }).strict(), req.body);
  const parent = body.parentId ? (await requireFolder(me.id, body.parentId, 'EDITOR')).folder : null;
  const ownerId = parent?.ownerId ?? me.id;

  const siblings = await prisma.folder.findMany({ where: { ownerId, parentId: parent?.id ?? null }, select: { name: true } });
  const folder = await prisma.folder.create({
    data: { name: uniqueName(sanitizeName(body.name, 'Nouveau dossier'), siblings.map((s) => s.name)), ownerId, parentId: parent?.id ?? null },
  });
  await logActivity(req, { action: 'folder.create', ownerId, actorId: me.id, targetName: folder.name, targetType: 'folder' });
  res.status(201).json(folder);
});

driveRouter.patch('/folders/:id', async (req, res) => {
  const me = userOf(req);
  const folderId = parse(id, req.params.id);
  const body = parse(z.object({ name: name.optional(), parentId: id.nullable().optional() }).strict(), req.body);
  const access = await requireFolder(me.id, folderId, 'EDITOR');
  const folder = access.folder;
  const data: { name?: string; parentId?: string | null } = {};

  if (body.parentId !== undefined && body.parentId !== folder.parentId) {
    await requireParentEdit(me.id, folder.ownerId, folder.parentId);
    const target = await resolveTarget(me.id, folder.ownerId, body.parentId);
    if (target && (await isInside(target.id, folder.id))) {
      throw badRequest('Impossible de déplacer un dossier dans lui-même ou dans l’un de ses sous-dossiers');
    }
    data.parentId = target?.id ?? null;
  }
  if (body.name !== undefined) data.name = sanitizeName(body.name, folder.name);

  const finalParent = data.parentId !== undefined ? data.parentId : folder.parentId;
  const finalName = data.name ?? folder.name;
  const clash = await prisma.folder.findFirst({
    where: { ownerId: folder.ownerId, parentId: finalParent, name: { equals: finalName, mode: 'insensitive' }, NOT: { id: folder.id } },
  });
  if (clash) throw conflict(`Un dossier « ${finalName} » existe déjà à cet endroit`);

  const updated = await prisma.folder.update({ where: { id: folder.id }, data });
  await logActivity(req, {
    action: data.parentId !== undefined ? 'move' : 'rename',
    ownerId: folder.ownerId,
    actorId: me.id,
    targetName: updated.name,
    targetType: 'folder',
    details: data.name && data.name !== folder.name ? `ancien nom : ${folder.name}` : undefined,
  });
  res.json(updated);
});

driveRouter.delete('/folders/:id', async (req, res) => {
  const me = userOf(req);
  const access = await requireFolder(me.id, parse(id, req.params.id), 'EDITOR');
  const folder = access.folder;
  await requireParentEdit(me.id, folder.ownerId, folder.parentId);

  // Tous les fichiers du sous-arbre, pour les effacer du disque après la base.
  const keys = await prisma.$queryRaw<{ storageKey: string }[]>`
    WITH RECURSIVE tree AS (
      SELECT id FROM "Folder" WHERE id = ${folder.id}
      UNION ALL
      SELECT f.id FROM "Folder" f JOIN tree t ON f."parentId" = t.id
    )
    SELECT "storageKey" FROM "File" WHERE "folderId" IN (SELECT id FROM tree)`;
  await prisma.folder.delete({ where: { id: folder.id } }); // cascade : sous-dossiers, fichiers, partages, liens
  await removeFromStorage(keys.map((k) => k.storageKey));
  await logActivity(req, {
    action: 'delete',
    ownerId: folder.ownerId,
    actorId: me.id,
    targetName: folder.name,
    targetType: 'folder',
    details: `${keys.length} fichier(s) supprimé(s)`,
  });
  res.status(204).end();
});

/* ---------------------------------------------------------------- fichiers */

const tmpDir = () => {
  const dir = join(config.storageDir, 'tmp');
  mkdirSync(dir, { recursive: true });
  return dir;
};

/**
 * Multer écrit chaque fichier dans un dossier temporaire du même disque que
 * le stockage (le rangement final est un simple renommage). Taille et nombre
 * de fichiers sont bornés avant même d'atteindre le code métier.
 */
const upload = multer({
  storage: multer.diskStorage({ destination: (_req, _file, cb) => cb(null, tmpDir()) }),
  limits: { fileSize: config.maxFileBytes, files: config.maxFilesPerUpload, fields: 5 },
});

driveRouter.post('/files', upload.array('files'), async (req: Request, res) => {
  const me = userOf(req);
  const incoming = (req.files as Express.Multer.File[] | undefined) ?? [];
  const cleanup = () => Promise.all(incoming.map((f) => rm(f.path, { force: true })));
  try {
    if (incoming.length === 0) throw badRequest('Aucun fichier reçu');
    const folderId = parse(id.nullable().optional(), req.body.folderId || null);
    const folder = folderId ? (await requireFolder(me.id, folderId, 'EDITOR')).folder : null;
    const ownerId = folder?.ownerId ?? me.id;

    // Quota du propriétaire de l'arborescence, pas de celui qui importe.
    const owner = await prisma.user.findUniqueOrThrow({ where: { id: ownerId }, select: { quotaBytes: true } });
    const used = (await prisma.file.aggregate({ where: { ownerId }, _sum: { size: true } }))._sum.size ?? 0n;
    const adding = incoming.reduce((sum, f) => sum + BigInt(f.size), 0n);
    const quota = config.demo && owner.quotaBytes > config.demoQuotaBytes ? config.demoQuotaBytes : owner.quotaBytes;
    if (used + adding > quota) {
      throw new HttpError(413, 'Espace de stockage insuffisant pour ces fichiers');
    }

    const siblings = new Set(
      (await prisma.file.findMany({ where: { ownerId, folderId: folder?.id ?? null }, select: { name: true } })).map((f) => f.name),
    );
    const created = [];
    for (const f of incoming) {
      // Multer décode le nom en latin1 : on le relit en UTF-8 pour garder les accents.
      const original = sanitizeName(Buffer.from(f.originalname, 'latin1').toString('utf8'));
      const finalName = uniqueName(original, siblings);
      siblings.add(finalName);
      const [head, sha256] = await Promise.all([readHead(f.path), sha256File(f.path)]);
      const storageKey = await moveToStorage(f.path);
      try {
        created.push(
          await prisma.file.create({
            data: {
              name: finalName,
              size: BigInt(f.size),
              mimeType: sniffMime(head, finalName),
              sha256,
              storageKey,
              ownerId,
              uploaderId: me.id,
              folderId: folder?.id ?? null,
            },
            select: fileSelect,
          }),
        );
      } catch (error) {
        await removeFromStorage([storageKey]);
        throw error;
      }
      await logActivity(req, { action: 'upload', ownerId, actorId: me.id, targetName: finalName, targetType: 'file' });
    }
    res.status(201).json(created.map(({ _count, uploader, ...f }) => ({ ...f, uploaderName: uploader.name, shared: false })));
  } finally {
    await cleanup();
  }
});

driveRouter.get('/files/:id', async (req, res) => {
  const me = userOf(req);
  const { file, role, visible } = await requireFile(me.id, parse(id, req.params.id), 'VIEWER');
  const [owner, uploader] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: file.ownerId }, select: { name: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: file.uploaderId }, select: { name: true } }),
  ]);
  const { storageKey: _key, ...safe } = file;
  res.json({ ...safe, role, ownerName: owner.name, uploaderName: uploader.name, breadcrumbs: crumbs(visible), previewable: PREVIEWABLE.has(file.mimeType) });
});

/**
 * Un lien <a href> ne peut pas porter l'en-tête Authorization. On délivre donc
 * un jeton de téléchargement signé, valable 60 secondes et pour ce seul
 * fichier : le navigateur télécharge ensuite en flux, sans tout charger en mémoire.
 */
driveRouter.post('/files/:id/download-token', async (req, res) => {
  const me = userOf(req);
  const { file } = await requireFile(me.id, parse(id, req.params.id), 'VIEWER');
  const token = jwt.sign({ fid: file.id }, config.jwtSecret, { subject: me.id, audience: 'download', expiresIn: '60s', algorithm: 'HS256' });
  res.json({ token });
});

driveRouter.patch('/files/:id', async (req, res) => {
  const me = userOf(req);
  const body = parse(z.object({ name: name.optional(), folderId: id.nullable().optional() }).strict(), req.body);
  const { file } = await requireFile(me.id, parse(id, req.params.id), 'EDITOR');
  const data: { name?: string; folderId?: string | null } = {};

  if (body.folderId !== undefined && body.folderId !== file.folderId) {
    await requireParentEdit(me.id, file.ownerId, file.folderId);
    data.folderId = (await resolveTarget(me.id, file.ownerId, body.folderId))?.id ?? null;
  }
  if (body.name !== undefined) data.name = sanitizeName(body.name, file.name);

  const finalFolder = data.folderId !== undefined ? data.folderId : file.folderId;
  const finalName = data.name ?? file.name;
  const clash = await prisma.file.findFirst({
    where: { ownerId: file.ownerId, folderId: finalFolder, name: { equals: finalName, mode: 'insensitive' }, NOT: { id: file.id } },
  });
  if (clash) throw conflict(`Un fichier « ${finalName} » existe déjà à cet endroit`);

  const updated = await prisma.file.update({ where: { id: file.id }, data, select: fileSelect });
  await logActivity(req, {
    action: data.folderId !== undefined ? 'move' : 'rename',
    ownerId: file.ownerId,
    actorId: me.id,
    targetName: updated.name,
    targetType: 'file',
    details: data.name && data.name !== file.name ? `ancien nom : ${file.name}` : undefined,
  });
  const { _count, uploader, ...rest } = updated;
  res.json({ ...rest, uploaderName: uploader.name });
});

driveRouter.delete('/files/:id', async (req, res) => {
  const me = userOf(req);
  const { file } = await requireFile(me.id, parse(id, req.params.id), 'EDITOR');
  await requireParentEdit(me.id, file.ownerId, file.folderId);
  await prisma.file.delete({ where: { id: file.id } });
  await removeFromStorage([file.storageKey]);
  await logActivity(req, { action: 'delete', ownerId: file.ownerId, actorId: me.id, targetName: file.name, targetType: 'file' });
  res.status(204).end();
});

/* ------------------------------------------------- téléchargement (public) */

/**
 * Hors de `requireAuth` : l'authentification se fait par le jeton de
 * téléchargement de 60 s. Les droits sont revérifiés à cet instant : un
 * partage retiré entre-temps bloque le téléchargement.
 */
export const downloadRouter = Router();

downloadRouter.get('/files/:id/download', async (req, res) => {
  const fileId = parse(id, req.params.id);
  let userId: string;
  try {
    const payload = jwt.verify(String(req.query.token ?? ''), config.jwtSecret, { audience: 'download', algorithms: ['HS256'] }) as jwt.JwtPayload;
    if (payload.fid !== fileId) throw new Error('fichier différent');
    userId = String(payload.sub);
  } catch {
    throw unauthorized('Lien de téléchargement expiré, relancez le téléchargement');
  }
  const access = await fileAccess(userId, fileId);
  if (!access) throw notFound('Fichier introuvable');

  const inline = req.query.inline === '1' && PREVIEWABLE.has(access.file.mimeType);
  sendStoredFile(res, access.file, inline);
  // Un aperçu dans le panneau de détails n'est pas un téléchargement : on ne l'inscrit pas au journal.
  if (!inline) {
    await logActivity(req, { action: 'download', ownerId: access.file.ownerId, actorId: userId, targetName: access.file.name, targetType: 'file' });
  }
});

/**
 * Envoie un fichier stocké avec des en-têtes défensifs : téléchargement forcé
 * (sauf aperçu d'une image), type jamais deviné par le navigateur,
 * et « sandbox » pour qu'un contenu affiché ne puisse exécuter aucun script.
 */
export function sendStoredFile(res: import('express').Response, file: { name: string; mimeType: string; size: bigint; sha256: string; storageKey: string }, inline: boolean) {
  res.setHeader('Content-Type', inline ? file.mimeType : 'application/octet-stream');
  res.setHeader('Content-Disposition', contentDisposition(file.name, inline));
  res.setHeader('Content-Length', file.size.toString());
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Checksum-SHA256', file.sha256);
  const stream = createReadStream(storagePath(file.storageKey));
  stream.on('error', () => {
    if (!res.headersSent) res.status(404).json({ message: 'Contenu du fichier introuvable' });
    else res.destroy();
  });
  stream.pipe(res);
}
