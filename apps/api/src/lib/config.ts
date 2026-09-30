import { resolve } from 'node:path';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variable d'environnement manquante : ${name}`);
  return value;
}

/** Configuration lue à la demande, une fois .env chargé. */
export const config = {
  get port() {
    return Number(process.env.PORT ?? 4200);
  },
  get webOrigin() {
    return process.env.WEB_ORIGIN ?? 'http://localhost:5174';
  },
  /** Adresse publique de l'interface : sert à fabriquer les liens de partage. */
  get publicUrl() {
    return process.env.PUBLIC_URL ?? this.webOrigin;
  },
  get jwtSecret() {
    return required('JWT_SECRET');
  },
  get production() {
    return process.env.NODE_ENV === 'production';
  },
  get storageDir() {
    return resolve(process.env.STORAGE_DIR ?? './storage');
  },
  accessTtl: '15m' as const,
  refreshTtlDays: 7,
  loginAttempts: 5,
  /** Taille maximale d'un fichier importé. */
  maxFileBytes: 100 * 1024 * 1024,
  /** Fichiers par envoi. */
  maxFilesPerUpload: 20,
  /** Tentatives de mot de passe sur un lien protégé, par lien et par adresse IP, toutes les 10 minutes. */
  linkPasswordAttempts: 10,
  /** Durée de validité d'un déverrouillage de lien protégé. */
  linkUnlockTtl: '10m' as const,
};
