import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { config } from './config';

/**
 * Nettoie un nom de fichier ou de dossier fourni par l'utilisateur.
 * Le nom n'est jamais utilisé comme chemin sur le disque (les fichiers y sont
 * rangés sous un identifiant aléatoire), mais il est affiché et renvoyé au
 * téléchargement : on retire séparateurs de chemin, caractères de contrôle
 * et espaces superflus.
 */
export function sanitizeName(raw: string, fallback = 'sans-nom'): string {
  const cleaned = raw
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '') // « ../x », « .env » : pas de nom qui commence par un point
    .trim()
    .slice(0, 200);
  return cleaned || fallback;
}

/**
 * Nom libre dans un dossier : « rapport.pdf » devient « rapport (2).pdf » si
 * « rapport.pdf » et « rapport (1).pdf » existent déjà. Comparaison insensible
 * à la casse, comme sous Windows et macOS.
 */
export function uniqueName(name: string, taken: Iterable<string>): string {
  const used = new Set([...taken].map((n) => n.toLowerCase()));
  if (!used.has(name.toLowerCase())) return name;
  const dot = name.lastIndexOf('.');
  const hasExt = dot > 0 && dot > name.length - 12;
  const base = hasExt ? name.slice(0, dot) : name;
  const ext = hasExt ? name.slice(dot) : '';
  for (let i = 1; ; i++) {
    const candidate = `${base} (${i})${ext}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
}

const SIGNATURES: { mime: string; bytes: number[]; offset?: number }[] = [
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: 'image/webp', bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
  { mime: 'application/zip', bytes: [0x50, 0x4b, 0x03, 0x04] },
  { mime: 'video/mp4', bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },
];

const TEXT_EXTENSIONS: Record<string, string> = {
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  json: 'application/json',
};

/**
 * Type du fichier d'après son contenu (« nombre magique »), jamais d'après ce
 * qu'annonce le navigateur. Un fichier non reconnu est un flux d'octets
 * générique : il sera toujours téléchargé, jamais affiché par le navigateur.
 */
export function sniffMime(head: Buffer, name: string): string {
  for (const sig of SIGNATURES) {
    const at = sig.offset ?? 0;
    if (head.length >= at + sig.bytes.length && sig.bytes.every((b, i) => head[at + i] === b)) {
      return sig.mime;
    }
  }
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  // Un « texte » ne doit contenir aucun octet nul (sinon c'est un binaire renommé).
  if (TEXT_EXTENSIONS[ext] && !head.includes(0)) return TEXT_EXTENSIONS[ext];
  return 'application/octet-stream';
}

/**
 * Types qu'on accepte d'afficher dans le navigateur (aperçu) : des images, et
 * rien d'autre. Un PDF, un SVG ou un HTML peuvent contenir du script ; ils sont
 * toujours téléchargés.
 */
export const PREVIEWABLE = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

/**
 * En-tête Content-Disposition compatible avec les noms accentués (RFC 6266 et
 * 5987) : une version ASCII de secours, puis le vrai nom encodé en UTF-8.
 */
export function contentDisposition(name: string, inline = false): string {
  const ascii = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

/** Chemin sur le disque : deux niveaux de sous-dossiers pour ne pas entasser des milliers de fichiers au même endroit. */
export function storagePath(key: string): string {
  return join(config.storageDir, key.slice(0, 2), key.slice(2, 4), key);
}

/** Empreinte SHA-256 d'un fichier, calculée en flux (pas de chargement complet en mémoire). */
export function sha256File(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(path)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject);
  });
}

/** Lit les premiers octets d'un fichier, pour en reconnaître le type. */
export function readHead(path: string, bytes = 16): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    createReadStream(path, { start: 0, end: bytes - 1 })
      .on('data', (c) => chunks.push(c as Buffer))
      .on('end', () => resolve(Buffer.concat(chunks)))
      .on('error', reject);
  });
}

/** Range un fichier temporaire dans le stockage définitif et renvoie sa clé. */
export async function moveToStorage(tempPath: string): Promise<string> {
  const key = randomUUID().replace(/-/g, '');
  const target = storagePath(key);
  await mkdir(dirname(target), { recursive: true });
  await rename(tempPath, target);
  return key;
}

export async function removeFromStorage(keys: string[]): Promise<void> {
  await Promise.all(keys.map((k) => rm(storagePath(k), { force: true })));
}
