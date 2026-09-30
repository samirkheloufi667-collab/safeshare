import type { Request } from 'express';
import { prisma } from './prisma';

/** Libellés des actions enregistrées dans le journal. */
export type Action =
  | 'upload'
  | 'download'
  | 'folder.create'
  | 'rename'
  | 'move'
  | 'delete'
  | 'share.grant'
  | 'share.update'
  | 'share.revoke'
  | 'link.create'
  | 'link.revoke'
  | 'link.download'
  | 'link.password_failed';

/**
 * Inscrit une action dans le journal du propriétaire concerné. L'échec de
 * l'écriture du journal ne doit jamais faire échouer l'action elle-même.
 */
export async function logActivity(
  req: Request,
  entry: { action: Action; ownerId: string; actorId?: string | null; targetName: string; targetType: 'file' | 'folder' | 'link'; details?: string },
) {
  try {
    await prisma.activity.create({
      data: { ...entry, actorId: entry.actorId ?? null, ip: req.ip ?? null },
    });
  } catch (error) {
    console.error('Journal d’activité indisponible :', error);
  }
}
