import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { join } from 'node:path';
import { config } from './lib/config';
import { errorHandler, notFound } from './lib/errors';
import { prisma } from './lib/prisma';
import { authRouter } from './routes/auth';
import { downloadRouter, driveRouter } from './routes/drive';
import { publicRouter } from './routes/public';
import { sharingRouter } from './routes/sharing';

/**
 * CORS minimal, sans dépendance : seule l'interface déclarée dans WEB_ORIGIN
 * peut appeler l'API avec des cookies. Les autres origines ne reçoivent
 * aucun en-tête d'autorisation, et le navigateur bloque leurs réponses.
 */
function cors(req: Request, res: Response, next: NextFunction) {
  if (req.headers.origin === config.webOrigin) {
    res.setHeader('Access-Control-Allow-Origin', config.webOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Checksum-SHA256');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Link-Access');
      res.setHeader('Access-Control-Max-Age', '600');
      res.status(204).end();
      return;
    }
  }
  next();
}

export function createApp() {
  const app = express();
  // Derrière le proxy de l'hébergeur, l'adresse IP réelle est dans X-Forwarded-For (limiteur, journal).
  app.set('trust proxy', config.production ? 1 : 'loopback');
  // Tailles et quotas sont des BigInt en base : JSON ne sait pas les écrire tels quels.
  app.set('json replacer', (_key: string, value: unknown) => (typeof value === 'bigint' ? Number(value) : value));
  app.disable('x-powered-by');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cors);
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', database: 'up' });
    } catch {
      res.status(503).json({ status: 'error', database: 'down' });
    }
  });

  app.use('/api/auth', authRouter);
  app.use('/api/public', publicRouter);
  app.use('/api', downloadRouter);
  app.use('/api', driveRouter);
  app.use('/api', sharingRouter);

  app.use('/api', (_req, _res, next) => next(notFound('Route inconnue')));

  // Production : l'API sert aussi l'interface compilée (application monopage).
  const webDist = config.webDist;
  if (webDist) {
    // Les fichiers de /assets ont une empreinte dans leur nom (Vite) : gardés un an.
    app.use('/assets', express.static(join(webDist, 'assets'), { immutable: true, maxAge: '1y' }));
    app.use(express.static(webDist, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(join(webDist, 'index.html'));
    });
  }

  app.use((_req, _res, next) => next(notFound('Route inconnue')));
  app.use(errorHandler);
  return app;
}
