/**
 * Démarre, avant tous les tests, une base PostgreSQL (PGlite) en mémoire et
 * lui applique les migrations Prisma.
 *
 * Ce fichier tourne dans le processus principal de Jest, hors du bac à sable
 * où s'exécutent les tests : PGlite y peut charger ses modules WebAssembly.
 */
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const E2E_PORT = 5546;

export default async function globalSetup() {
  const db = await PGlite.create();
  const server = new PGLiteSocketServer({ db, port: E2E_PORT, host: '127.0.0.1' });
  await server.start();

  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'prisma', 'migrations');
  for (const entry of readdirSync(dir).filter((e) => !e.endsWith('.toml')).sort()) {
    await db.exec(readFileSync(join(dir, entry, 'migration.sql'), 'utf8'));
  }

  globalThis.__SAFESHARE_PG__ = { db, server };
}
