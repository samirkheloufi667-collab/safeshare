# SafeShare

Plateforme de **stockage et de partage de fichiers sécurisé** : une arborescence
de dossiers, des partages nominatifs en lecture ou en modification hérités par
tout le contenu d'un dossier, des liens publics qui expirent (mot de passe et
nombre de téléchargements en option), et un journal de chaque accès.

> Projet de portfolio full stack — React · TypeScript · Node.js · Express · PostgreSQL · JWT · Docker

> **Démo en ligne : [safeshare-gws7.onrender.com](https://safeshare-gws7.onrender.com)** — compte `demo@safeshare.dev` / `safeshare2026`.
> Hébergement gratuit : le premier chargement peut prendre environ une minute ; les données de démonstration sont réinitialisées à chaque redémarrage.

## Fonctionnalités

| | |
|---|---|
| **Arborescence** | Dossiers et sous-dossiers, import par glisser-déposer avec barre de progression, renommage, déplacement, suppression récursive, doublons numérotés (« rapport (1).pdf »). |
| **Permissions** | Partage à une personne en *lecture seule* ou *peut modifier*. Un partage de dossier vaut pour tout son contenu ; l'invité ne voit pas les dossiers situés au-dessus. Le propriétaire voit aussi les accès hérités. |
| **Liens temporaires** | Durée (1 h à 30 jours), mot de passe, nombre maximal de téléchargements, désactivation immédiate. Le lien n'est affiché qu'une fois : la base n'en garde que l'empreinte. |
| **Journal d'activité** | Imports, téléchargements (y compris anonymes via un lien), partages, créations et désactivations de liens, mots de passe erronés, avec l'heure et l'adresse IP. |
| **Intégrité** | Empreinte SHA-256 calculée à l'import et renvoyée à chaque téléchargement. |
| **Quota** | 1 Go par compte ; un éditeur qui importe dans un dossier partagé consomme le quota du propriétaire. |

## Démarrage rapide

Prérequis : Node.js 22 ou plus.

### Sans Docker

Une base PostgreSQL embarquée (PGlite) remplace le serveur PostgreSQL.

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
npm run db:setup      # migrations + données de démo (vrais fichiers générés)
npm run db:local      # laisse tourner la base (terminal 1)
npm run dev:api       # API sur :4200 (terminal 2)
npm run dev:web       # interface sur :5174 (terminal 3)
```

### Avec Docker

```bash
docker compose up --build
docker compose exec -e NODE_ENV=development api npx tsx prisma/seed.ts
```

Interface : http://localhost:8080 · API : http://localhost:4200/api

### Comptes de démonstration

Mot de passe commun : `safeshare2026` — la page de connexion propose des boutons pour les remplir.

| E-mail | Rôle dans la démo |
|---|---|
| `demo@safeshare.dev` | Léa, propriétaire : arborescence complète, partages et liens dans tous les états |
| `karim@safeshare.dev` | Karim, **peut modifier** le dossier « Refonte site 2027 » de Léa |
| `sofia@safeshare.dev` | Sofia, **lecture seule** sur le même dossier |

`npm run db:setup` affiche aussi deux liens publics prêts à tester, dont un protégé par le mot de passe `client2027`.

## Tests

```bash
npm test            # 25 tests unitaires : noms de fichiers, détection du type, en-têtes, état des liens, rôles
npm run test:e2e    # 24 tests de bout en bout sur une vraie base PostgreSQL en mémoire
```

Les tests de bout en bout rejouent des scénarios d'attaque : un HTML déguisé
servi en téléchargement forcé, un jeton de téléchargement réutilisé pour un
autre fichier, un lien de dossier détourné vers un fichier extérieur, un lien
épuisé, expiré ou désactivé, un mot de passe erroné, un invité qui tente de
supprimer le dossier partagé ou de l'emporter dans son espace, un jeton de
session volé rejoué.

## Structure

```
apps/
  api/   Express 5 + Prisma 6 (PostgreSQL) + Multer + Zod + jsonwebtoken
  web/   React 19 + Vite + React Router + Tailwind CSS 4
docs/
  ARCHITECTURE.md   choix techniques et leurs raisons
docker-compose.yml  PostgreSQL, API, interface (nginx)
```

## Crédits

Composants animés de [React Bits](https://reactbits.dev) : LetterGlitch,
DecryptedText, ShinyText et SpotlightCard (adapté au thème) — provenance
indiquée en tête de chaque fichier de `apps/web/src/components/reactbits/`.
Icônes [Lucide](https://lucide.dev).
