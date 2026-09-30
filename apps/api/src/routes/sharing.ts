import { Router } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { folderChain, requireFile, requireFolder } from '../lib/access';
import { logActivity } from '../lib/activity';
import { config } from '../lib/config';
import { badRequest, forbidden, notFound } from '../lib/errors';
import { LINK_DURATIONS, linkState } from '../lib/links';
import { hashPassword } from '../lib/password';
import { prisma } from '../lib/prisma';
import { id, parse } from '../lib/validate';
import { requireAuth, userOf } from '../middleware/auth';

export const sharingRouter = Router();
sharingRouter.use(requireAuth);

/** Un partage ou un lien vise soit un dossier, soit un fichier : jamais les deux, jamais aucun. */
const target = z
  .object({ folderId: id.optional(), fileId: id.optional() })
  .refine((t) => Boolean(t.folderId) !== Boolean(t.fileId), { message: 'Indiquez un dossier ou un fichier' });

/** Seul le propriétaire gère qui a accès à un élément. */
async function requireOwnedTarget(userId: string, t: { folderId?: string; fileId?: string }) {
  if (t.folderId) {
    const { folder } = await requireFolder(userId, t.folderId, 'OWNER');
    return { folderId: folder.id, fileId: undefined, name: folder.name, type: 'folder' as const, ownerId: folder.ownerId, parentId: folder.parentId };
  }
  const { file } = await requireFile(userId, t.fileId!, 'OWNER');
  return { folderId: undefined, fileId: file.id, name: file.name, type: 'file' as const, ownerId: file.ownerId, parentId: file.folderId };
}

/* ------------------------------------------------------ partages nominatifs */

sharingRouter.get('/shares', async (req, res) => {
  const me = userOf(req);
  const t = await requireOwnedTarget(me.id, parse(target, req.query));
  const select = { id: true, role: true, createdAt: true, user: { select: { id: true, name: true, email: true } } } as const;
  const direct = await prisma.share.findMany({
    where: { folderId: t.folderId ?? undefined, fileId: t.fileId ?? undefined },
    select,
    orderBy: { createdAt: 'asc' },
  });
  // Accès hérités : partages posés sur un dossier parent. Les montrer évite de
  // laisser croire que « personne d'autre n'a accès » alors que c'est faux.
  const ancestors = t.parentId ? await folderChain(t.parentId) : [];
  const inherited = ancestors.length
    ? await prisma.share.findMany({
        where: { folderId: { in: ancestors.map((a) => a.id) } },
        select: { ...select, folder: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      })
    : [];
  res.json([
    ...direct.map((s) => ({ ...s, inheritedFrom: null })),
    ...inherited.map(({ folder, ...s }) => ({ ...s, inheritedFrom: folder })),
  ]);
});

sharingRouter.post('/shares', async (req, res) => {
  const me = userOf(req);
  const body = parse(
    target.and(
      z.object({
        email: z.string().trim().toLowerCase().pipe(z.email({ message: 'Adresse e-mail invalide' })),
        role: z.enum(['VIEWER', 'EDITOR']),
      }),
    ),
    req.body,
  );
  const t = await requireOwnedTarget(me.id, body);
  const recipient = await prisma.user.findUnique({ where: { email: body.email }, select: { id: true, name: true } });
  // Message volontairement neutre : on ne confirme pas l'existence d'un compte à un tiers.
  if (!recipient) throw badRequest('Aucun compte SafeShare ne correspond à cet e-mail');
  if (recipient.id === me.id) throw badRequest('Vous avez déjà tous les droits sur vos fichiers');

  const where = t.folderId
    ? { userId_folderId: { userId: recipient.id, folderId: t.folderId } }
    : { userId_fileId: { userId: recipient.id, fileId: t.fileId! } };
  const share = await prisma.share.upsert({
    where,
    update: { role: body.role },
    create: { role: body.role, userId: recipient.id, grantedById: me.id, folderId: t.folderId, fileId: t.fileId },
    select: { id: true, role: true, createdAt: true, user: { select: { id: true, name: true, email: true } } },
  });
  await logActivity(req, {
    action: 'share.grant',
    ownerId: t.ownerId,
    actorId: me.id,
    targetName: t.name,
    targetType: t.type,
    details: `${recipient.name} (${body.role === 'EDITOR' ? 'modification' : 'lecture'})`,
  });
  res.status(201).json(share);
});

async function loadShare(shareId: string) {
  const share = await prisma.share.findUnique({
    where: { id: shareId },
    include: { folder: true, file: true, user: { select: { name: true } } },
  });
  if (!share) throw notFound('Partage introuvable');
  const owner = share.folder?.ownerId ?? share.file!.ownerId;
  return { share, owner, name: share.folder?.name ?? share.file!.name, type: share.folder ? ('folder' as const) : ('file' as const) };
}

sharingRouter.patch('/shares/:id', async (req, res) => {
  const me = userOf(req);
  const { role } = parse(z.object({ role: z.enum(['VIEWER', 'EDITOR']) }).strict(), req.body);
  const { share, owner, name, type } = await loadShare(parse(id, req.params.id));
  if (owner !== me.id) throw notFound('Partage introuvable');
  const updated = await prisma.share.update({ where: { id: share.id }, data: { role } });
  await logActivity(req, { action: 'share.update', ownerId: owner, actorId: me.id, targetName: name, targetType: type, details: `${share.user.name} → ${role === 'EDITOR' ? 'modification' : 'lecture'}` });
  res.json(updated);
});

/** Le propriétaire retire un accès ; le destinataire peut aussi quitter un partage. */
sharingRouter.delete('/shares/:id', async (req, res) => {
  const me = userOf(req);
  const { share, owner, name, type } = await loadShare(parse(id, req.params.id));
  if (owner !== me.id && share.userId !== me.id) throw notFound('Partage introuvable');
  await prisma.share.delete({ where: { id: share.id } });
  await logActivity(req, {
    action: 'share.revoke',
    ownerId: owner,
    actorId: me.id,
    targetName: name,
    targetType: type,
    details: share.userId === me.id ? `${share.user.name} a quitté le partage` : `accès retiré à ${share.user.name}`,
  });
  res.status(204).end();
});

/** Ce qu'on m'a partagé : les points d'entrée, pas tout leur contenu. */
sharingRouter.get('/shared', async (req, res) => {
  const me = userOf(req);
  const shares = await prisma.share.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      role: true,
      createdAt: true,
      grantedBy: { select: { name: true } },
      folder: { select: { id: true, name: true, updatedAt: true, _count: { select: { children: true, files: true } } } },
      file: { select: { id: true, name: true, size: true, mimeType: true, updatedAt: true } },
    },
  });
  res.json(
    shares.map((s) => ({
      id: s.id,
      role: s.role,
      sharedAt: s.createdAt,
      grantedBy: s.grantedBy.name,
      folder: s.folder && { id: s.folder.id, name: s.folder.name, updatedAt: s.folder.updatedAt, itemCount: s.folder._count.children + s.folder._count.files },
      file: s.file,
    })),
  );
});

/* ------------------------------------------------------- liens temporaires */

const linkSelect = {
  id: true,
  tokenHint: true,
  label: true,
  expiresAt: true,
  maxDownloads: true,
  downloadCount: true,
  revokedAt: true,
  createdAt: true,
  passwordHash: true,
  folder: { select: { id: true, name: true } },
  file: { select: { id: true, name: true } },
} as const;

type LinkRow = { passwordHash: string | null; expiresAt: Date; revokedAt: Date | null; maxDownloads: number | null; downloadCount: number };

/** Ne renvoie jamais l'empreinte du mot de passe : seulement le fait qu'il y en a un. */
const present = <T extends LinkRow>({ passwordHash, ...link }: T) => ({ ...link, protected: passwordHash !== null, state: linkState({ ...link }) });

sharingRouter.get('/links', async (req, res) => {
  const me = userOf(req);
  const q = parse(z.object({ folderId: id.optional(), fileId: id.optional() }), req.query);
  if (q.folderId || q.fileId) await requireOwnedTarget(me.id, q);
  const links = await prisma.link.findMany({
    where: { createdById: me.id, folderId: q.folderId, fileId: q.fileId },
    select: linkSelect,
    orderBy: { createdAt: 'desc' },
  });
  res.json(links.map(present));
});

/**
 * Crée un lien public. Le jeton (32 octets aléatoires) n'est renvoyé qu'une
 * seule fois, dans cette réponse : la base n'en garde que l'empreinte SHA-256.
 * Une fuite de la base ne donne donc accès à aucun lien.
 */
sharingRouter.post('/links', async (req, res) => {
  const me = userOf(req);
  const body = parse(
    target.and(
      z.object({
        duration: z.enum(Object.keys(LINK_DURATIONS) as [string, ...string[]]),
        password: z.string().min(6, 'Le mot de passe du lien doit faire au moins 6 caractères').max(128).optional(),
        maxDownloads: z.number().int().min(1).max(1000).optional(),
        label: z.string().trim().max(80).optional(),
      }),
    ),
    req.body,
  );
  const t = await requireOwnedTarget(me.id, body);
  const token = randomBytes(32).toString('base64url');
  const link = await prisma.link.create({
    data: {
      tokenHash: createHash('sha256').update(token).digest('hex'),
      tokenHint: token.slice(-4),
      label: body.label || null,
      passwordHash: body.password ? await hashPassword(body.password) : null,
      expiresAt: new Date(Date.now() + LINK_DURATIONS[body.duration]),
      maxDownloads: body.maxDownloads ?? null,
      createdById: me.id,
      folderId: t.folderId,
      fileId: t.fileId,
    },
    select: linkSelect,
  });
  await logActivity(req, {
    action: 'link.create',
    ownerId: t.ownerId,
    actorId: me.id,
    targetName: t.name,
    targetType: t.type,
    details: `expire le ${link.expiresAt.toLocaleString('fr-FR')}${body.password ? ', protégé par mot de passe' : ''}${body.maxDownloads ? `, ${body.maxDownloads} téléchargement(s) max.` : ''}`,
  });
  res.status(201).json({ ...present(link), url: `${config.publicUrl}/l/${token}` });
});

sharingRouter.delete('/links/:id', async (req, res) => {
  const me = userOf(req);
  const link = await prisma.link.findUnique({ where: { id: parse(id, req.params.id) }, include: { folder: true, file: true } });
  if (!link || link.createdById !== me.id) throw notFound('Lien introuvable');
  if (link.revokedAt) throw forbidden('Ce lien est déjà désactivé');
  await prisma.link.update({ where: { id: link.id }, data: { revokedAt: new Date() } });
  await logActivity(req, {
    action: 'link.revoke',
    ownerId: me.id,
    actorId: me.id,
    targetName: link.folder?.name ?? link.file?.name ?? 'lien',
    targetType: link.folder ? 'folder' : 'file',
    details: `lien …${link.tokenHint}`,
  });
  res.status(204).end();
});

/* ------------------------------------------------------------------ journal */

sharingRouter.get('/activity', async (req, res) => {
  const me = userOf(req);
  const limit = parse(z.coerce.number().int().min(1).max(200).default(100), req.query.limit);
  const entries = await prisma.activity.findMany({
    where: { ownerId: me.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, action: true, targetName: true, targetType: true, details: true, ip: true, createdAt: true, actor: { select: { id: true, name: true } } },
  });
  res.json(entries);
});
