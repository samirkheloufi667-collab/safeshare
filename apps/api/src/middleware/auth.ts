import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../lib/config';
import { unauthorized } from '../lib/errors';

export interface AuthUser {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/** Exige un jeton d'accès valide (en-tête Authorization: Bearer …). */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const [type, token] = (req.headers.authorization ?? '').split(' ');
  if (type !== 'Bearer' || !token) return next(unauthorized());
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'], audience: 'api' }) as jwt.JwtPayload;
    req.user = { id: String(payload.sub), email: String(payload.email) };
    next();
  } catch {
    next(unauthorized('Session expirée ou invalide'));
  }
}

/** Utilisateur connecté (après requireAuth). */
export const userOf = (req: Request): AuthUser => {
  if (!req.user) throw unauthorized();
  return req.user;
};
