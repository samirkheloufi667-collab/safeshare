import { Router, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireAuth, userOf } from '../middleware/auth';
import { config } from '../lib/config';
import { conflict, HttpError, unauthorized } from '../lib/errors';
import { hashPassword, verifyPassword } from '../lib/password';
import { prisma } from '../lib/prisma';
import { limiter } from '../lib/rate-limiter';
import { daysFromNow, hashToken, newRefreshToken } from '../lib/tokens';
import { parse } from '../lib/validate';

export const authRouter = Router();

const REFRESH_COOKIE = 'ss_refresh';
const COOKIE_PATH = '/api/auth';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Adresse e-mail invalide' }));

const registerSchema = z
  .object({
    email,
    name: z.string().trim().min(2, 'Le nom doit faire au moins 2 caractères').max(60),
    password: z.string().min(10, 'Le mot de passe doit faire au moins 10 caractères').max(128),
  })
  .strict();

const loginSchema = z.object({ email, password: z.string().min(1).max(128) }).strict();

function signAccess(user: { id: string; email: string }) {
  return jwt.sign({ email: user.email }, config.jwtSecret, {
    subject: user.id,
    audience: 'api',
    expiresIn: config.accessTtl,
    algorithm: 'HS256',
  });
}

/**
 * Ouvre une session : jeton d'accès court renvoyé dans le corps (gardé en
 * mémoire par le navigateur), jeton de rafraîchissement dans un cookie
 * httpOnly (inaccessible au JavaScript de la page).
 */
async function openSession(res: Response, user: { id: string; email: string }, familyId: string = randomUUID()) {
  const refreshToken = newRefreshToken();
  const expiresAt = daysFromNow(config.refreshTtlDays);
  await prisma.refreshToken.create({ data: { tokenHash: hashToken(refreshToken), familyId, userId: user.id, expiresAt } });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.production,
    path: COOKIE_PATH,
    expires: expiresAt,
  });
  return { accessToken: signAccess(user) };
}

authRouter.post('/register', async (req, res) => {
  if (config.demo) {
    throw new HttpError(403, 'Les inscriptions sont fermées sur la démo publique : utilisez un compte de démonstration.');
  }
  const body = parse(registerSchema, req.body);
  if (await prisma.user.findUnique({ where: { email: body.email } })) {
    throw conflict('Un compte existe déjà avec cet e-mail');
  }
  const user = await prisma.user.create({
    data: { email: body.email, name: body.name, passwordHash: await hashPassword(body.password) },
  });
  res.status(201).json(await openSession(res, user));
});

authRouter.post('/login', async (req, res) => {
  const body = parse(loginSchema, req.body);
  const key = `login:${req.ip}:${body.email}`;
  if (!limiter.hit(key, config.loginAttempts, 60_000)) {
    throw new HttpError(429, 'Trop de tentatives. Réessayez dans une minute.');
  }
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  // Même réponse que l'e-mail existe ou non : on ne révèle pas quels comptes existent.
  const valid = user ? await verifyPassword(body.password, user.passwordHash) : false;
  if (!user || !valid) throw unauthorized('E-mail ou mot de passe incorrect');
  limiter.reset(key);
  res.json(await openSession(res, user));
});

/**
 * Rotation : chaque rafraîchissement consomme le jeton et en émet un nouveau
 * dans la même famille. Un jeton déjà consommé qui revient a été copié :
 * toute la famille est révoquée.
 */
authRouter.post('/refresh', async (req, res) => {
  const token: string | undefined = req.cookies?.[REFRESH_COOKIE];
  const fail = (message: string) => {
    res.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
    return unauthorized(message);
  };
  if (!token) throw fail('Session absente');

  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!stored) throw fail('Session invalide');
  if (stored.revokedAt) {
    await prisma.refreshToken.updateMany({ where: { familyId: stored.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
    throw fail('Session révoquée, reconnectez-vous');
  }
  if (stored.expiresAt <= new Date()) throw fail('Session expirée');

  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
  res.json(await openSession(res, stored.user, stored.familyId));
});

authRouter.post('/logout', async (req, res) => {
  const token: string | undefined = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
  }
  res.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
  res.status(204).end();
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const { id } = userOf(req);
  const [user, usage] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id }, select: { id: true, email: true, name: true, quotaBytes: true, createdAt: true } }),
    prisma.file.aggregate({ where: { ownerId: id }, _sum: { size: true }, _count: true }),
  ]);
  res.json({ ...user, usedBytes: usage._sum.size ?? 0n, fileCount: usage._count });
});
