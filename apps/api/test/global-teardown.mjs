export default async function globalTeardown() {
  const pg = globalThis.__SAFESHARE_PG__;
  if (!pg) return;
  await pg.server.stop();
  await pg.db.close();
}
