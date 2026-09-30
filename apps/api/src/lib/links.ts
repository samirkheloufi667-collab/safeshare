import type { Link } from '@prisma/client';

export type LinkState = 'active' | 'expired' | 'revoked' | 'exhausted';

/**
 * État d'un lien public à un instant donné. Fonction pure : l'horloge est un
 * paramètre, ce qui rend chaque cas testable sans attendre.
 */
export function linkState(link: Pick<Link, 'expiresAt' | 'revokedAt' | 'maxDownloads' | 'downloadCount'>, now = new Date()): LinkState {
  if (link.revokedAt) return 'revoked';
  if (link.expiresAt <= now) return 'expired';
  if (link.maxDownloads !== null && link.downloadCount >= link.maxDownloads) return 'exhausted';
  return 'active';
}

export const LINK_STATE_MESSAGE: Record<Exclude<LinkState, 'active'>, string> = {
  revoked: 'Ce lien a été désactivé par son auteur.',
  expired: 'Ce lien a expiré.',
  exhausted: 'Ce lien a atteint son nombre maximal de téléchargements.',
};

/** Durées proposées à la création d'un lien. */
export const LINK_DURATIONS: Record<string, number> = {
  '1h': 3_600_000,
  '24h': 86_400_000,
  '7d': 7 * 86_400_000,
  '30d': 30 * 86_400_000,
};
