import { createHash, randomBytes } from 'node:crypto';

/** Jeton de rafraîchissement opaque : 48 octets aléatoires, encodés en base64url. */
export function newRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

/** Seule l'empreinte est stockée en base. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
