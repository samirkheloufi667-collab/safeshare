/**
 * Démarre un vrai PostgreSQL en local, sans Docker ni installation.
 *
 * PGlite est PostgreSQL compilé en WebAssembly : il tourne dans Node, et le
 * serveur de sockets l'expose sur le port 5435 avec le protocole réseau de
 * PostgreSQL. Prisma s'y connecte comme à n'importe quelle base.
 *
 *   npm run db:local        (à laisser tourner dans un terminal)
 *
 * Les données sont conservées dans apps/api/.pglite/.
 * PGlite n'accepte qu'une connexion à la fois : DATABASE_URL contient donc
 * connection_limit=1. En production, on utilise le PostgreSQL de docker-compose.
 */
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, '..', '.pglite');
const port = Number(process.env.PGLITE_PORT ?? 5435);

mkdirSync(dataDir, { recursive: true });
const db = await PGlite.create(dataDir);
// Par défaut, pglite-socket n'accepte qu'une connexion, et une connexion coupée
// sur erreur n'est pas toujours libérée : la reconnexion de Prisma serait alors
// refusée (« Too many connections ») et l'API perdrait la base. On autorise donc
// quelques connexions ; PGlite exécute de toute façon les requêtes une par une,
// sans mélanger deux transactions.
const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: 8 });
await server.start();

console.log(`PostgreSQL local (PGlite) prêt : postgresql://postgres:postgres@127.0.0.1:${port}/postgres`);
console.log(`Données : ${dataDir}`);
console.log('Ctrl+C pour arrêter.');

const stop = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
