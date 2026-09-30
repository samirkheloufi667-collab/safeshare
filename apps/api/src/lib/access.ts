import type { File as StoredFile, ShareRole } from '@prisma/client';
import { forbidden, notFound } from './errors';
import { prisma } from './prisma';

export type Role = ShareRole | 'OWNER';

const RANK: Record<Role, number> = { VIEWER: 1, EDITOR: 2, OWNER: 3 };

export const atLeast = (role: Role, required: Role) => RANK[role] >= RANK[required];

export function strongest(roles: Role[]): Role | null {
  return roles.reduce<Role | null>((best, r) => (!best || RANK[r] > RANK[best] ? r : best), null);
}

export interface ChainItem {
  id: string;
  name: string;
  parentId: string | null;
  ownerId: string;
}

/**
 * Chaîne des dossiers de la racine jusqu'à `folderId` inclus, en une seule
 * requête récursive : c'est elle qui permet l'héritage des partages (un
 * dossier partagé donne accès à tout ce qu'il contient, à n'importe quelle
 * profondeur).
 */
export async function folderChain(folderId: string): Promise<ChainItem[]> {
  const rows = await prisma.$queryRaw<(ChainItem & { depth: number })[]>`
    WITH RECURSIVE chain AS (
      SELECT id, name, "parentId", "ownerId", 0 AS depth FROM "Folder" WHERE id = ${folderId}
      UNION ALL
      SELECT f.id, f.name, f."parentId", f."ownerId", c.depth + 1
      FROM "Folder" f JOIN chain c ON f.id = c."parentId"
      WHERE c.depth < 64
    )
    SELECT id, name, "parentId", "ownerId", depth FROM chain ORDER BY depth DESC`;
  return rows.map(({ depth: _depth, ...item }) => item);
}

/**
 * Rôle de l'utilisateur sur un dossier, et la partie de l'arborescence qu'il
 * a le droit de voir. Un invité ne voit pas les noms des dossiers situés
 * au-dessus de celui qu'on lui a partagé : le fil d'Ariane commence là.
 */
async function resolveChain(userId: string, chain: ChainItem[], extraRoles: Role[] = []) {
  if (chain.length === 0) return null;
  if (chain[0].ownerId === userId) return { role: 'OWNER' as Role, visible: chain };

  const shares = await prisma.share.findMany({
    where: { userId, folderId: { in: chain.map((c) => c.id) } },
    select: { folderId: true, role: true },
  });
  const role = strongest([...shares.map((s) => s.role), ...extraRoles]);
  if (!role) return null;

  const firstShared = chain.findIndex((c) => shares.some((s) => s.folderId === c.id));
  return { role, visible: firstShared === -1 ? [] : chain.slice(firstShared) };
}

export async function folderAccess(userId: string, folderId: string) {
  const chain = await folderChain(folderId);
  const resolved = await resolveChain(userId, chain);
  return resolved ? { ...resolved, folder: chain[chain.length - 1] } : null;
}

export async function fileAccess(userId: string, fileId: string) {
  const file = await prisma.file.findUnique({ where: { id: fileId } });
  if (!file) return null;
  if (file.ownerId === userId) {
    const visible = file.folderId ? await folderChain(file.folderId) : [];
    return { role: 'OWNER' as Role, file, visible };
  }
  const direct = await prisma.share.findUnique({ where: { userId_fileId: { userId, fileId } }, select: { role: true } });
  const chain = file.folderId ? await folderChain(file.folderId) : [];
  const resolved = chain.length ? await resolveChain(userId, chain, direct ? [direct.role] : []) : null;
  const role = resolved?.role ?? direct?.role ?? null;
  if (!role) return null;
  return { role, file, visible: resolved?.visible ?? [] };
}

/**
 * Exige un rôle minimal. Sans aucun accès : 404, comme si l'élément
 * n'existait pas (un 403 confirmerait son existence). Avec un accès
 * insuffisant : 403, puisque l'utilisateur voit déjà l'élément.
 */
export async function requireFolder(userId: string, folderId: string, required: Role) {
  const access = await folderAccess(userId, folderId);
  if (!access) throw notFound('Dossier introuvable');
  if (!atLeast(access.role, required)) throw forbidden(forbiddenMessage(required));
  return access;
}

export async function requireFile(userId: string, fileId: string, required: Role) {
  const access = await fileAccess(userId, fileId);
  if (!access) throw notFound('Fichier introuvable');
  if (!atLeast(access.role, required)) throw forbidden(forbiddenMessage(required));
  return access as { role: Role; file: StoredFile; visible: ChainItem[] };
}

const forbiddenMessage = (required: Role) =>
  required === 'OWNER' ? 'Seul le propriétaire peut faire cela' : 'Vous avez un accès en lecture seule';

/** Vrai si `folderId` est `ancestorId` lui-même ou l'un de ses descendants. */
export async function isInside(folderId: string, ancestorId: string): Promise<boolean> {
  const chain = await folderChain(folderId);
  return chain.some((c) => c.id === ancestorId);
}
