import './lib/env';
import { createApp } from './app';
import { config } from './lib/config';
import { prisma } from './lib/prisma';

const server = createApp().listen(config.port, () => {
  console.log(`SafeShare — API prête sur http://localhost:${config.port}/api`);
});

// Arrêt propre : on termine les requêtes en cours avant de fermer la base.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => void prisma.$disconnect().then(() => process.exit(0)));
  });
}
