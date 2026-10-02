/**
 * Données de démonstration : quatre personnes fictives, une arborescence,
 * des partages, des liens dans tous les états et un journal d'activité.
 * Les fichiers sont générés ici (images PNG, PDF, CSV, notes) et réellement
 * enregistrés dans le stockage, empreinte SHA-256 comprise.
 *
 *   npm run db:seed        (efface puis recrée tout)
 */
import '../src/lib/env';
import { PrismaClient, type ShareRole } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import { config } from '../src/lib/config';
import { moveToStorage, sniffMime } from '../src/lib/files';
import { hashPassword } from '../src/lib/password';

const prisma = new PrismaClient();
const DAY = 86_400_000;
const PASSWORD = 'safeshare2026';

/* ---------------------------------------------------- fichiers générés */

/** PNG en dégradé, encodé à la main (en-tête, données compressées, CRC). */
function png(width: number, height: number, from: [number, number, number], to: [number, number, number]): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits par canal
  ihdr[9] = 2; // RVB
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    for (let x = 0; x < width; x++) {
      const t = (x / width) * 0.6 + (y / height) * 0.4;
      for (let c = 0; c < 3; c++) raw[row + 1 + x * 3 + c] = Math.round(from[c] + (to[c] - from[c]) * t);
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** PDF d'une page avec un titre et quelques lignes. */
function pdf(title: string, lines: string[]): Buffer {
  const text = [title, '', ...lines]
    .map((l, i) => `BT /F1 ${i === 0 ? 20 : 12} Tf 72 ${760 - i * 22} Td (${l.replace(/[()\\]/g, '')}) Tj ET`)
    .join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(text, 'latin1')} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

const csv = (rows: (string | number)[][]) => Buffer.from(rows.map((r) => r.join(';')).join('\n') + '\n', 'utf8');
const md = (s: string) => Buffer.from(s.trim() + '\n', 'utf8');

/* ---------------------------------------------------------------- script */

async function main() {
  // En production, seulement pour une démo publique qui se réinitialise à chaque démarrage.
  if (process.env.NODE_ENV === 'production' && process.env.DEMO_MODE !== 'true') {
    throw new Error('Refus de charger des données de démonstration en production');
  }

  await prisma.$transaction([
    prisma.activity.deleteMany(),
    prisma.link.deleteMany(),
    prisma.share.deleteMany(),
    prisma.file.deleteMany(),
    prisma.folder.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.user.deleteMany(),
  ]);
  await rm(config.storageDir, { recursive: true, force: true });
  const tmp = join(config.storageDir, 'tmp');
  await mkdir(tmp, { recursive: true });

  const passwordHash = await hashPassword(PASSWORD);
  const user = (email: string, name: string) => prisma.user.create({ data: { email, name, passwordHash } });
  const lea = await user('demo@safeshare.dev', 'Léa Martin');
  const thomas = await user('thomas@safeshare.dev', 'Thomas Garnier');
  const sofia = await user('sofia@safeshare.dev', 'Sofia Rossi');
  await user('hugo@safeshare.dev', 'Hugo Lefèvre');

  const ago = (days: number) => new Date(Date.now() - days * DAY);
  const folder = (name: string, ownerId: string, parentId: string | null, days: number) =>
    prisma.folder.create({ data: { name, ownerId, parentId, createdAt: ago(days), updatedAt: ago(Math.max(0, days - 3)) } });

  async function file(name: string, content: Buffer, ownerId: string, folderId: string | null, days: number, uploaderId = ownerId) {
    const path = join(tmp, randomBytes(8).toString('hex'));
    await writeFile(path, content);
    const storageKey = await moveToStorage(path);
    return prisma.file.create({
      data: {
        name,
        size: BigInt(content.length),
        mimeType: sniffMime(content.subarray(0, 16), name),
        sha256: createHash('sha256').update(content).digest('hex'),
        storageKey,
        ownerId,
        uploaderId,
        folderId,
        createdAt: ago(days),
        updatedAt: ago(days),
      },
    });
  }

  // Espace de Léa.
  const projets = await folder('Projets', lea.id, null, 40);
  const refonte = await folder('Refonte site 2027', lea.id, projets.id, 30);
  const maquettes = await folder('Maquettes', lea.id, refonte.id, 28);
  const livrables = await folder('Livrables client', lea.id, refonte.id, 20);
  const admin = await folder('Administratif', lea.id, null, 60);
  const factures = await folder('Factures 2026', lea.id, admin.id, 55);
  const photos = await folder('Photos équipe', lea.id, null, 12);

  await file('Accueil — version A.png', png(640, 400, [124, 92, 255], [20, 18, 40]), lea.id, maquettes.id, 27);
  await file('Accueil — version B.png', png(640, 400, [242, 181, 68], [30, 22, 12]), lea.id, maquettes.id, 26);
  // Importé par Thomas, qui peut modifier ce dossier : le fichier appartient quand même à Léa.
  await file('Parcours mobile.png', png(360, 720, [61, 219, 200], [12, 30, 40]), lea.id, maquettes.id, 18, thomas.id);
  await file(
    'Cahier des charges.pdf',
    pdf('Refonte du site - cahier des charges', ['Objectif : un site plus rapide et accessible.', 'Livraison : printemps 2027.', 'Budget : voir Budget previsionnel.csv']),
    lea.id,
    refonte.id,
    29,
  );
  await file(
    'Notes de réunion.md',
    md(`
# Réunion de lancement — refonte 2027

- Priorité : l'accessibilité (RGAA) et le temps de chargement mobile.
- Thomas prend les maquettes, Sofia relit les textes.
- Prochain point : dans deux semaines.
`),
    lea.id,
    refonte.id,
    25,
  );
  await file('Livrable 1 — arborescence.pdf', pdf('Livrable 1 - arborescence', ['Accueil', 'Offres', 'A propos', 'Contact']), lea.id, livrables.id, 10);
  await file('Planning.csv', csv([['Étape', 'Début', 'Fin'], ['Maquettes', '2026-10-01', '2026-11-15'], ['Développement', '2026-11-16', '2027-02-28'], ['Mise en ligne', '2027-03-15', '2027-03-15']]), lea.id, livrables.id, 9);
  for (const [i, month] of ['janvier', 'février', 'mars', 'avril'].entries()) {
    await file(`Facture ${month} 2026.pdf`, pdf(`Facture - ${month} 2026`, [`Montant : ${1200 + i * 150} EUR HT`, 'Reglee']), lea.id, factures.id, 50 - i * 10);
  }
  await file('Attestation assurance.pdf', pdf('Attestation d assurance', ['Valable jusqu au 31/12/2026']), lea.id, admin.id, 58);
  await file('Séminaire — groupe.png', png(800, 500, [255, 140, 90], [60, 20, 60]), lea.id, photos.id, 11);
  await file('Séminaire — atelier.png', png(800, 500, [90, 160, 255], [10, 20, 60]), lea.id, photos.id, 11);
  await file('À lire en premier.txt', Buffer.from('Bienvenue sur SafeShare.\nGlissez des fichiers dans cette fenêtre pour les importer.\n', 'utf8'), lea.id, null, 40);

  // Espace de Thomas, dont un fichier partagé avec Léa.
  const budget = await folder('Budget', thomas.id, null, 15);
  const budgetFile = await file('Budget prévisionnel.csv', csv([['Poste', 'Montant'], ['Design', 8000], ['Développement', 21000], ['Hébergement', 1200]]), thomas.id, budget.id, 14);
  await file('Devis hébergeur.pdf', pdf('Devis hebergement', ['Offre annuelle : 1200 EUR']), thomas.id, budget.id, 13);

  // Partages nominatifs.
  const share = (userId: string, role: ShareRole, grantedById: string, target: { folderId?: string; fileId?: string }, days: number) =>
    prisma.share.create({ data: { userId, role, grantedById, ...target, createdAt: ago(days) } });
  await share(thomas.id, 'EDITOR', lea.id, { folderId: refonte.id }, 29);
  await share(sofia.id, 'VIEWER', lea.id, { folderId: refonte.id }, 24);
  await share(lea.id, 'VIEWER', thomas.id, { fileId: budgetFile.id }, 14);

  // Liens dans tous les états, pour voir chaque cas dans l'interface.
  const link = async (data: { folderId?: string; fileId?: string; expiresAt: Date; password?: string; maxDownloads?: number; downloadCount?: number; revokedAt?: Date; label?: string; days: number }) => {
    const token = randomBytes(32).toString('base64url');
    await prisma.link.create({
      data: {
        tokenHash: createHash('sha256').update(token).digest('hex'),
        tokenHint: token.slice(-4),
        label: data.label ?? null,
        passwordHash: data.password ? await hashPassword(data.password) : null,
        expiresAt: data.expiresAt,
        maxDownloads: data.maxDownloads ?? null,
        downloadCount: data.downloadCount ?? 0,
        revokedAt: data.revokedAt ?? null,
        createdById: lea.id,
        folderId: data.folderId,
        fileId: data.fileId,
        createdAt: ago(data.days),
      },
    });
    return `${config.publicUrl}/l/${token}`;
  };
  const clientLink = await link({ folderId: livrables.id, expiresAt: new Date(Date.now() + 6 * DAY), password: 'client2027', label: 'Pour le client', days: 1 });
  const openLink = await link({ folderId: photos.id, expiresAt: new Date(Date.now() + 20 * 3_600_000), maxDownloads: 20, downloadCount: 3, label: 'Photos du séminaire', days: 0.2 });
  await link({ folderId: factures.id, expiresAt: ago(3), label: 'Comptable — T1', days: 10 });
  await link({ folderId: maquettes.id, expiresAt: new Date(Date.now() + 5 * DAY), maxDownloads: 2, downloadCount: 2, days: 2 });
  await link({ folderId: admin.id, expiresAt: new Date(Date.now() + 2 * DAY), revokedAt: ago(0.5), days: 1 });

  // Journal d'activité.
  const log = (action: string, actorId: string | null, targetName: string, targetType: string, days: number, details?: string) =>
    prisma.activity.create({ data: { action, ownerId: lea.id, actorId, targetName, targetType, details, ip: actorId ? '192.0.2.10' : '198.51.100.7', createdAt: ago(days) } });
  await log('share.grant', lea.id, 'Refonte site 2027', 'folder', 29, 'Thomas Garnier (modification)');
  await log('share.grant', lea.id, 'Refonte site 2027', 'folder', 24, 'Sofia Rossi (lecture)');
  await log('upload', thomas.id, 'Parcours mobile.png', 'file', 18);
  await log('download', sofia.id, 'Cahier des charges.pdf', 'file', 6);
  await log('link.create', lea.id, 'Livrables client', 'folder', 1, 'protégé par mot de passe');
  await log('link.password_failed', null, 'Livrables client', 'link', 0.8, 'lien protégé');
  await log('link.download', null, 'Livrable 1 — arborescence.pdf', 'file', 0.7, 'via le lien « Pour le client »');
  await log('link.create', lea.id, 'Photos équipe', 'folder', 0.2, '20 téléchargements max.');
  await log('link.revoke', lea.id, 'Administratif', 'folder', 0.5);

  await rm(tmp, { recursive: true, force: true });
  console.log(`SafeShare : 4 comptes, ${await prisma.folder.count()} dossiers, ${await prisma.file.count()} fichiers, ${await prisma.link.count()} liens.`);
  console.log(`Comptes (mot de passe ${PASSWORD}) : demo@safeshare.dev (Léa), thomas@safeshare.dev, sofia@safeshare.dev, hugo@safeshare.dev`);
  console.log(`Lien client (mot de passe client2027) : ${clientLink}`);
  console.log(`Lien photos (sans mot de passe)      : ${openLink}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
