import type { ErrorRequestHandler } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';

/** Erreur prévue : son statut et son message sont renvoyés tels quels au client. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (m: string) => new HttpError(400, m);
export const unauthorized = (m = 'Authentification requise') => new HttpError(401, m);
export const forbidden = (m = 'Action non autorisée') => new HttpError(403, m);
/** Utilisé aussi quand l'élément existe mais n'est pas accessible : on ne révèle pas son existence. */
export const notFound = (m = 'Élément introuvable') => new HttpError(404, m);
export const conflict = (m: string) => new HttpError(409, m);
export const gone = (m: string) => new HttpError(410, m);

/**
 * Dernier middleware : transforme toute erreur en réponse JSON. Une erreur
 * imprévue donne un 500 générique ; son détail reste dans les journaux du
 * serveur, jamais dans la réponse.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ message: err.issues.map((i) => i.message).join(' · ') });
    return;
  }
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Fichier trop volumineux (100 Mo maximum)'
        : err.code === 'LIMIT_FILE_COUNT'
          ? 'Trop de fichiers en un seul envoi (20 maximum)'
          : 'Envoi de fichier invalide';
    res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ message });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ message: 'Corps de requête JSON invalide' });
    return;
  }
  console.error(err);
  res.status(500).json({ message: 'Erreur interne du serveur' });
};
