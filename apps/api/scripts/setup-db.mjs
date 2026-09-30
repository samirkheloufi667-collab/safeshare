/**
 * Prépare la base locale : applique les migrations, puis charge la démo.
 *
 *   npm run db:setup      (à lancer AVANT npm run db:local, pas pendant)
 *
 * PGlite est un PostgreSQL à session unique : après la déconnexion d'un client,
 * la session peut rester dans un état qui fait échouer le client suivant. On
 * ouvre donc une session neuve pour chaque outil — une pour les migrations,
 * une pour la démo — et db:local en ouvrira une dernière pour l'API.
 * Avec le PostgreSQL de docker-compose, cette précaution est inutile.
 */
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = resolve(apiDir, '.pglite');
const port = Number(process.env.PGLITE_PORT ?? 5435);
const url = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?connection_limit=1&sslmode=disable&pgbouncer=true`;

function run(command, args) {
  return new Promise((ok, fail) => {
    // Commande en une seule chaîne : les arguments sont des constantes du script,
    // jamais une saisie utilisateur. Le shell est nécessaire pour trouver npx sous Windows.
    const child = spawn([command, ...args].join(' '), {
      cwd: apiDir,
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, DATABASE_URL: url },
    });
    child.on('exit', (code) => (code === 0 ? ok() : fail(new Error(`${command} ${args.join(' ')} : code ${code}`))));
  });
}

/** Ouvre la base, exécute une commande contre elle, puis referme tout. */
async function withFreshSession(label, command, args) {
  console.log(`\n→ ${label}`);
  const db = await PGlite.create(dataDir);
  const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1' });
  await server.start();
  try {
    await run(command, args);
  } finally {
    await server.stop();
    await db.close();
  }
}

mkdirSync(dataDir, { recursive: true });
try {
  await withFreshSession('Migrations', 'npx', ['prisma', 'migrate', 'deploy']);
  if (!process.argv.includes('--no-seed')) {
    await withFreshSession('Données de démonstration', 'npx', ['tsx', 'prisma/seed.ts']);
  }
  console.log('\nBase prête. Lancez maintenant : npm run db:local');
} catch (error) {
  if (String(error.message).includes('EADDRINUSE') || String(error).includes('EADDRINUSE')) {
    console.error(`\nLe port ${port} est occupé : arrêtez d'abord npm run db:local.`);
  } else {
    console.error(`\nÉchec : ${error.message}`);
  }
  process.exit(1);
}
