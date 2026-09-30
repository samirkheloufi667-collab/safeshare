import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * Hachage des mots de passe avec scrypt, fourni par Node : pas de module natif
 * à compiler, et un algorithme coûteux en mémoire qui freine les attaques par
 * GPU. Format stocké : scrypt$<sel base64>$<empreinte base64>.
 */
const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, saltB64, keyB64] = stored.split('$');
  if (algorithm !== 'scrypt' || !saltB64 || !keyB64) return false;

  const expected = Buffer.from(keyB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length);
  // Comparaison en temps constant : sinon la durée de la réponse révélerait
  // combien d'octets correspondent.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
