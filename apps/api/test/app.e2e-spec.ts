/**
 * Tests de bout en bout : l'application Express complète contre un vrai
 * PostgreSQL (PGlite en mémoire, démarré par global-setup.mjs). Chaque test
 * rejoue un scénario d'usage ou d'attaque par HTTP.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import type { Express } from 'express';

const PORT = 5546;
let app: Express;
let http: ReturnType<typeof request>;
let prisma: import('@prisma/client').PrismaClient;

type Account = { token: string; id: string; email: string };

async function register(email: string, name = 'Utilisateur Test'): Promise<Account> {
  const res = await http.post('/api/auth/register').send({ email, name, password: 'motdepasse-solide' });
  expect(res.status).toBe(201);
  const me = await http.get('/api/auth/me').set('Authorization', `Bearer ${res.body.accessToken}`);
  return { token: res.body.accessToken, id: me.body.id, email };
}

const auth = (a: Account) => ({ Authorization: `Bearer ${a.token}` });

async function mkdir(a: Account, name: string, parentId?: string) {
  const res = await http.post('/api/folders').set(auth(a)).send({ name, parentId });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

async function upload(a: Account, folderId: string | null, name: string, content: Buffer | string) {
  const req = http.post('/api/files').set(auth(a)).attach('files', Buffer.from(content), name);
  if (folderId) req.field('folderId', folderId);
  return req;
}

async function download(a: Account, fileId: string) {
  const t = await http.post(`/api/files/${fileId}/download-token`).set(auth(a));
  if (t.status !== 200) return t;
  return http.get(`/api/files/${fileId}/download`).query({ token: t.body.token }).buffer(true).parse(binary);
}

/** Supertest : récupérer le corps brut, quel que soit le type annoncé. */
function binary(res: request.Response, cb: (err: Error | null, body: Buffer) => void) {
  const stream = res as unknown as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  stream.on('data', (c: Buffer) => chunks.push(c));
  stream.on('end', () => cb(null, Buffer.concat(chunks)));
}

const tokenOf = (url: string) => url.split('/l/')[1];

beforeAll(async () => {
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?connection_limit=1&sslmode=disable`;
  process.env.JWT_SECRET = 'secret-de-test';
  process.env.STORAGE_DIR = mkdtempSync(join(tmpdir(), 'safeshare-'));
  process.env.WEB_ORIGIN = 'http://localhost:5174';
  // Import après avoir fixé l'environnement : le client Prisma lit DATABASE_URL à sa création.
  const { createApp } = await import('../src/app');
  app = createApp();
  http = request(app);
  prisma = (await import('../src/lib/prisma')).prisma;
}, 60_000);

afterAll(async () => {
  await prisma?.$disconnect();
});

describe('authentification', () => {
  it('protège les routes privées et laisse la santé publique', async () => {
    expect((await http.get('/api/health')).body).toEqual({ status: 'ok', database: 'up' });
    expect((await http.get('/api/drive')).status).toBe(401);
  });

  it('refuse un mot de passe trop court et un champ inattendu', async () => {
    expect((await http.post('/api/auth/register').send({ email: 'a@test.dev', name: 'Anne', password: 'court' })).status).toBe(400);
    expect((await http.post('/api/auth/register').send({ email: 'a@test.dev', name: 'Anne', password: 'motdepasse-solide', quotaBytes: 1e12 })).status).toBe(400);
  });

  it('fait tourner le jeton de rafraîchissement et révoque la famille en cas de réutilisation', async () => {
    await register('rotation@test.dev');
    const login = await http.post('/api/auth/login').send({ email: 'rotation@test.dev', password: 'motdepasse-solide' });
    const first = ([] as string[]).concat(login.headers['set-cookie']).find((c) => c.startsWith('ss_refresh='))!.split(';')[0];
    const second = await http.post('/api/auth/refresh').set('Cookie', first);
    expect(second.status).toBe(200);
    const cookie2 = ([] as string[]).concat(second.headers['set-cookie']).find((c) => c.startsWith('ss_refresh='))!.split(';')[0];
    expect((await http.post('/api/auth/refresh').set('Cookie', first)).status).toBe(401); // jeton volé rejoué
    expect((await http.post('/api/auth/refresh').set('Cookie', cookie2)).status).toBe(401); // toute la famille est révoquée
  });
});

describe('fichiers', () => {
  let lea: Account;
  beforeAll(async () => {
    lea = await register('lea@test.dev', 'Léa');
  });

  it('restitue exactement le fichier importé, avec son empreinte', async () => {
    const content = 'contenu de test ' + 'x'.repeat(1000);
    const up = await upload(lea, null, 'note.txt', content);
    expect(up.status).toBe(201);
    expect(up.body[0].mimeType).toBe('text/plain');
    const res = await download(lea, up.body[0].id);
    expect(res.status).toBe(200);
    expect(res.body.toString()).toBe(content);
    expect(res.headers['x-checksum-sha256']).toBe(up.body[0].sha256);
  });

  it('nettoie un nom malveillant et renomme les doublons', async () => {
    // Selon le client, le chemin est retiré avant l'envoi ou par le serveur : dans les deux cas, aucun séparateur ne subsiste.
    const a = await upload(lea, null, '../../evil.sh', 'echo');
    expect(a.body[0].name).not.toMatch(/[\\/]/);
    expect(a.body[0].name.startsWith('.')).toBe(false);
    await upload(lea, null, 'double.txt', 'premier');
    const b = await upload(lea, null, 'double.txt', 'second');
    expect(b.body[0].name).toBe('double (1).txt');
  });

  it('force le téléchargement d’un HTML et interdit au navigateur de deviner le type', async () => {
    const up = await upload(lea, null, 'page.html', '<script>alert(document.cookie)</script>');
    expect(up.body[0].mimeType).toBe('application/octet-stream');
    const t = await http.post(`/api/files/${up.body[0].id}/download-token`).set(auth(lea));
    const res = await http.get(`/api/files/${up.body[0].id}/download`).query({ token: t.body.token, inline: '1' });
    expect(res.headers['content-disposition']).toMatch(/^attachment/);
    expect(res.headers['content-type']).toBe('application/octet-stream');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('un jeton de téléchargement ne vaut que pour son fichier', async () => {
    const one = (await upload(lea, null, 'un.txt', '1')).body[0].id;
    const two = (await upload(lea, null, 'deux.txt', '2')).body[0].id;
    const t = await http.post(`/api/files/${one}/download-token`).set(auth(lea));
    expect((await http.get(`/api/files/${two}/download`).query({ token: t.body.token })).status).toBe(401);
  });

  it('refuse un envoi qui dépasse le quota', async () => {
    const small = await register('petit@test.dev');
    await prisma.user.update({ where: { id: small.id }, data: { quotaBytes: 100n } });
    const res = await upload(small, null, 'gros.bin', Buffer.alloc(500));
    expect(res.status).toBe(413);
  });

  it("empêche de déplacer un dossier dans son propre sous-dossier", async () => {
    const parent = await mkdir(lea, 'Parent');
    const child = await mkdir(lea, 'Enfant', parent);
    const res = await http.patch(`/api/folders/${parent}`).set(auth(lea)).send({ parentId: child });
    expect(res.status).toBe(400);
  });

  it('un inconnu reçoit 404, pas 403, sur le dossier d’un autre', async () => {
    const secret = await mkdir(lea, 'Secret');
    const intrus = await register('intrus@test.dev');
    expect((await http.get(`/api/folders/${secret}`).set(auth(intrus))).status).toBe(404);
    expect((await upload(intrus, secret, 'x.txt', 'x')).status).toBe(404);
  });
});

describe('partages et héritage', () => {
  let owner: Account;
  let viewer: Account;
  let editor: Account;
  let root: string;
  let sub: string;
  let deepFile: string;

  beforeAll(async () => {
    owner = await register('owner@test.dev', 'Propriétaire');
    viewer = await register('viewer@test.dev', 'Lectrice');
    editor = await register('editor@test.dev', 'Éditeur');
    const top = await mkdir(owner, 'Privé');
    root = await mkdir(owner, 'Projet', top);
    sub = await mkdir(owner, 'Sous-dossier', root);
    deepFile = (await upload(owner, sub, 'profond.txt', 'contenu profond')).body[0].id;
    await http.post('/api/shares').set(auth(owner)).send({ folderId: root, email: viewer.email, role: 'VIEWER' }).expect(201);
    await http.post('/api/shares').set(auth(owner)).send({ folderId: root, email: editor.email, role: 'EDITOR' }).expect(201);
  });

  it('un partage de dossier donne accès à tout son contenu, à toute profondeur', async () => {
    expect((await download(viewer, deepFile)).status).toBe(200);
  });

  it("l'invité ne voit pas les dossiers situés au-dessus du partage", async () => {
    const res = await http.get(`/api/folders/${sub}`).set(auth(viewer));
    expect(res.body.breadcrumbs.map((b: { name: string }) => b.name)).toEqual(['Projet', 'Sous-dossier']);
  });

  it('un lecteur ne peut ni importer ni renommer', async () => {
    expect((await upload(viewer, sub, 'x.txt', 'x')).status).toBe(403);
    expect((await http.patch(`/api/files/${deepFile}`).set(auth(viewer)).send({ name: 'pirate.txt' })).status).toBe(403);
  });

  it("un éditeur importe dans l'espace du propriétaire, qui reste propriétaire", async () => {
    const res = await upload(editor, sub, 'ajout.txt', 'ajout');
    expect(res.status).toBe(201);
    expect(res.body[0].ownerId).toBe(owner.id);
  });

  it("un éditeur ne peut ni supprimer ni sortir le dossier qu'on lui a partagé", async () => {
    expect((await http.delete(`/api/folders/${root}`).set(auth(editor))).status).toBe(403);
    const mine = await mkdir(editor, 'À moi');
    expect((await http.patch(`/api/folders/${sub}`).set(auth(editor)).send({ parentId: mine })).status).toBe(400);
  });

  it('seul le propriétaire gère les partages et les liens', async () => {
    expect((await http.post('/api/shares').set(auth(editor)).send({ folderId: root, email: viewer.email, role: 'EDITOR' })).status).toBe(403);
    expect((await http.post('/api/links').set(auth(editor)).send({ folderId: root, duration: '1h' })).status).toBe(403);
  });

  it('le propriétaire voit aussi les accès hérités d’un dossier parent', async () => {
    const res = await http.get('/api/shares').query({ folderId: sub }).set(auth(owner));
    expect(res.status).toBe(200);
    const inherited = res.body.filter((s: { inheritedFrom: { name: string } | null }) => s.inheritedFrom?.name === 'Projet');
    expect(inherited.map((s: { user: { email: string } }) => s.user.email).sort()).toEqual([editor.email, viewer.email].sort());
  });

  it("retirer le partage coupe l'accès immédiatement", async () => {
    const shares = await http.get('/api/shares').query({ folderId: root }).set(auth(owner));
    const share = shares.body.find((s: { user: { email: string } }) => s.user.email === viewer.email);
    await http.delete(`/api/shares/${share.id}`).set(auth(owner)).expect(204);
    expect((await http.get(`/api/folders/${sub}`).set(auth(viewer))).status).toBe(404);
  });
});

describe('liens temporaires', () => {
  let lea: Account;
  let fileId: string;
  beforeAll(async () => {
    lea = await register('liens@test.dev', 'Léa');
    fileId = (await upload(lea, null, 'contrat.pdf', '%PDF-1.4 contrat')).body[0].id;
  });

  it("ne stocke jamais le jeton lui-même, seulement son empreinte", async () => {
    const res = await http.post('/api/links').set(auth(lea)).send({ fileId, duration: '1h' });
    expect(res.status).toBe(201);
    const stored = await prisma.link.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(stored.tokenHash).not.toContain(tokenOf(res.body.url));
    expect(JSON.stringify(stored)).not.toContain(tokenOf(res.body.url));
  });

  it('permet le téléchargement sans compte, puis respecte la limite de téléchargements', async () => {
    const res = await http.post('/api/links').set(auth(lea)).send({ fileId, duration: '1h', maxDownloads: 1 });
    const token = tokenOf(res.body.url);
    expect((await http.get(`/api/public/links/${token}/download`)).status).toBe(200);
    expect((await http.get(`/api/public/links/${token}/download`)).status).toBe(410);
  });

  it('refuse un lien expiré ou désactivé', async () => {
    const expired = await http.post('/api/links').set(auth(lea)).send({ fileId, duration: '1h' });
    await prisma.link.update({ where: { id: expired.body.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await http.get(`/api/public/links/${tokenOf(expired.body.url)}/download`)).status).toBe(410);

    const revoked = await http.post('/api/links').set(auth(lea)).send({ fileId, duration: '1h' });
    await http.delete(`/api/links/${revoked.body.id}`).set(auth(lea)).expect(204);
    const meta = await http.get(`/api/public/links/${tokenOf(revoked.body.url)}`);
    expect(meta.body.state).toBe('revoked');
    expect(meta.body.files).toBeUndefined();
  });

  it('exige le mot de passe, et ne révèle rien du contenu avant', async () => {
    const res = await http.post('/api/links').set(auth(lea)).send({ fileId, duration: '1h', password: 'secret123' });
    const token = tokenOf(res.body.url);
    const locked = await http.get(`/api/public/links/${token}`);
    expect(locked.body.protected).toBe(true);
    expect(locked.body.files).toBeUndefined();
    expect((await http.get(`/api/public/links/${token}/download`)).status).toBe(401);
    expect((await http.post(`/api/public/links/${token}/unlock`).send({ password: 'mauvais' })).status).toBe(401);

    const unlock = await http.post(`/api/public/links/${token}/unlock`).send({ password: 'secret123' });
    expect(unlock.status).toBe(200);
    const dl = await http.get(`/api/public/links/${token}/download`).set('X-Link-Access', unlock.body.access);
    expect(dl.status).toBe(200);
  });

  it("un lien de dossier ne donne accès qu'aux fichiers de ce dossier", async () => {
    const shared = await mkdir(lea, 'Partagé');
    const inside = (await upload(lea, shared, 'dedans.txt', 'ok')).body[0].id;
    const outside = (await upload(lea, null, 'dehors.txt', 'secret')).body[0].id;
    const res = await http.post('/api/links').set(auth(lea)).send({ folderId: shared, duration: '1h' });
    const token = tokenOf(res.body.url);
    expect((await http.get(`/api/public/links/${token}/download`).query({ fileId: inside })).status).toBe(200);
    expect((await http.get(`/api/public/links/${token}/download`).query({ fileId: outside })).status).toBe(404);
  });

  it('inscrit les téléchargements anonymes dans le journal du propriétaire', async () => {
    const res = await http.get('/api/activity').set(auth(lea));
    expect(res.body.some((e: { action: string }) => e.action === 'link.download')).toBe(true);
  });
});
