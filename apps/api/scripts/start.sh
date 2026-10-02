#!/bin/sh
# Démarrage en production.
# - DB_URL + DB_SCHEMA : plusieurs projets peuvent partager une même base
#   PostgreSQL, chacun dans son propre schéma.
# - DEMO_MODE=true : la démo publique est remise à zéro à chaque démarrage.
set -e
if [ -n "$DB_URL" ]; then
  export DATABASE_URL="${DB_URL}?schema=${DB_SCHEMA:-public}"
fi
npx prisma migrate deploy
if [ "$DEMO_MODE" = "true" ]; then
  npx tsx prisma/seed.ts
fi
exec node dist/server.js
