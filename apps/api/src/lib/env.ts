// Chargé en tout premier par main.ts : lit le fichier .env avant que le reste
// de l'application ne consulte process.env. Node 20.6+ le fait nativement,
// ce qui évite une dépendance de plus.
try {
  process.loadEnvFile();
} catch {
  // Pas de .env : les variables viennent de l'environnement (Docker, CI).
}
