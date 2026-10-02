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
    // Sur Render, l'interface est servie par l'API elle-même : même adresse.
    return process.env.WEB_ORIGIN ?? process.env.RENDER_EXTERNAL_URL ?? 'http://localhost:5174';
  },
  /** Adresse publique de l'interface : sert à fabriquer les liens de partage. */
  get publicUrl() {
    return process.env.PUBLIC_URL ?? this.webOrigin;
  },
  /** Dossier de l'interface compilée, servie par l'API en production (une seule adresse, cookies de premier niveau). */
  get webDist() {
    return process.env.WEB_DIST;
  },
  /**
   * Démo publique : inscriptions fermées (on utilise les comptes de démo),
   * quotas réduits et données remises à zéro à chaque démarrage. Évite qu'une
   * démo ouverte à tous serve à héberger des fichiers malveillants.
   */
  get demo() {
    return process.env.DEMO_MODE === 'true';
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
  get maxFileBytes() {
    return (this.demo ? 5 : 100) * 1024 * 1024;
  },
  /** Plafond de stockage par compte sur la démo publique. */
  demoQuotaBytes: 30n * 1024n * 1024n,
  /** Fichiers par envoi. */
  maxFilesPerUpload: 20,
  /** Tentatives de mot de passe sur un lien protégé, par lien et par adresse IP, toutes les 10 minutes. */
  linkPasswordAttempts: 10,
  /** Durée de validité d'un déverrouillage de lien protégé. */
  linkUnlockTtl: '10m' as const,
};
