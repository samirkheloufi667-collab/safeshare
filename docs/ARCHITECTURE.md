# Architecture de SafeShare

Chaque section explique **pourquoi** le code est construit ainsi, pour pouvoir
le défendre en entretien.

## Vue d'ensemble

```
Navigateur ──► React + Vite (apps/web)          drive, partage, liens, journal
     │
     ├──────► Express (apps/api)  /api/*         sécurité, règles d'accès
     │            ├── Prisma ──► PostgreSQL      métadonnées, partages, journal
     │            └── disque   ──► storage/      contenu des fichiers
     │
Destinataire sans compte ──► /l/<jeton>  ──► /api/public/links/<jeton>
```

Express plutôt que NestJS ici : l'application reste petite, et Express oblige à
écrire explicitement ce qu'un framework cache (garde d'authentification,
validation, gestion des erreurs). Express 5 transmet de lui-même les erreurs des
fonctions `async` au gestionnaire d'erreurs, ce qui évite les `try/catch` partout.

## Modèle de données

- `Folder` : arborescence par `parentId`. `ownerId` est le propriétaire de
  **toute** l'arborescence : un sous-dossier créé par un éditeur invité
  appartient au propriétaire du dossier partagé.
- `File` : métadonnées seulement (nom, taille, type, SHA-256, clé de stockage).
  Le contenu est sur le disque, sous une clé aléatoire.
- `Share` : accès nominatif à un dossier **ou** à un fichier, rôle `VIEWER` ou `EDITOR`.
- `Link` : lien public. Seule l'**empreinte SHA-256 du jeton** est stockée, plus
  ses quatre derniers caractères pour le reconnaître dans une liste.
- `Activity` : journal, rangé par propriétaire concerné.

Les tailles et quotas sont des `BigInt` (un fichier peut dépasser 2 Go) ; un
« replacer » JSON d'Express les convertit en nombres à la sortie.

## Qui a accès à quoi (`src/lib/access.ts`)

Une requête SQL **récursive** remonte la chaîne des dossiers, de l'élément
jusqu'à la racine :

```sql
WITH RECURSIVE chain AS (
  SELECT id, name, "parentId", "ownerId", 0 AS depth FROM "Folder" WHERE id = $1
  UNION ALL
  SELECT f.id, f.name, f."parentId", f."ownerId", c.depth + 1
  FROM "Folder" f JOIN chain c ON f.id = c."parentId"
)
```

- propriétaire de la racine → `OWNER` ;
- sinon, le rôle le plus fort parmi les partages posés sur un dossier de la
  chaîne (et, pour un fichier, sur le fichier lui-même) ;
- aucun accès → **404** (un 403 confirmerait que l'élément existe) ; accès
  insuffisant → 403 ;
- le fil d'Ariane d'un invité commence au dossier partagé : les noms des
  dossiers situés au-dessus ne lui sont jamais envoyés.

Règles d'édition :

| Action | Condition |
|---|---|
| lire, télécharger | `VIEWER` |
| importer, créer un dossier, renommer | `EDITOR` sur le dossier (ou l'élément) |
| **déplacer, supprimer** | propriétaire, ou `EDITOR` sur le dossier **parent** : un invité ne peut ni supprimer ni emporter le dossier qu'on lui a partagé |
| partager, créer un lien | propriétaire uniquement |

Un déplacement vérifie que la destination appartient au même propriétaire
(sinon on transférerait des fichiers dans l'espace et le quota d'un autre) et
qu'un dossier n'est pas déplacé dans l'un de ses propres descendants.

## Fichiers

1. **Import** : Multer écrit dans `storage/tmp` (même disque que le stockage
   final, le rangement est un simple renommage), avec des limites de taille
   (100 Mo) et de nombre (20 fichiers). Le quota du propriétaire est vérifié
   avant d'enregistrer quoi que ce soit.
2. **Nom** : nettoyé (séparateurs de chemin, caractères de contrôle, nom
   commençant par un point) et rendu unique dans son dossier. Il n'est
   **jamais** utilisé comme chemin disque.
3. **Type** : déduit des premiers octets du fichier, jamais de l'extension ni
   du navigateur. Un HTML ou un script non reconnu devient `application/octet-stream`.
4. **Empreinte** : SHA-256 calculée en flux, sans charger le fichier en mémoire.

**Téléchargement** : un lien `<a>` ne peut pas porter l'en-tête `Authorization`.
L'interface demande donc un **jeton de téléchargement** signé, valable 60
secondes et pour ce seul fichier, puis le navigateur télécharge en flux. Les
droits sont revérifiés à cet instant.

**En-têtes défensifs** à chaque envoi : `Content-Disposition: attachment`
(sauf aperçu d'une image), `Content-Type: application/octet-stream`,
`X-Content-Type-Options: nosniff`, et une `Content-Security-Policy` avec
`sandbox`. Un fichier piégé ne peut donc pas s'exécuter dans l'origine de l'application.

## Liens publics (`src/routes/public.ts`)

- Jeton de 32 octets aléatoires (256 bits), transmis une seule fois ; la base
  n'en stocke que l'empreinte : une fuite de la base ne donne accès à aucun lien.
- État calculé par une fonction pure (`linkState`) testée unitairement :
  actif, expiré, désactivé ou épuisé.
- **Mot de passe** : haché avec scrypt. Le bon mot de passe donne un jeton de
  déverrouillage de 10 minutes, propre à ce lien. Tant que le lien est
  verrouillé, l'API ne révèle ni la liste ni les noms des fichiers. 10 essais
  par lien et par adresse IP toutes les 10 minutes, et chaque échec est journalisé.
- **Limite de téléchargements** : décompte **atomique** —
  `UPDATE … SET downloadCount = downloadCount + 1 WHERE … downloadCount < max`.
  Deux téléchargements simultanés ne peuvent pas dépasser la limite.
- Un lien de dossier ne sert que les fichiers de ce dossier (sous-dossiers
  compris), vérifiés par la même requête récursive.
- La page `/l/<jeton>` et nginx envoient `Referrer-Policy: no-referrer` : le
  jeton contenu dans l'adresse n'est pas transmis aux autres sites.

## Authentification

Même modèle que mes autres projets : jeton d'accès JWT de 15 minutes gardé en
mémoire côté navigateur, jeton de rafraîchissement opaque en cookie `httpOnly`
limité à `/api/auth`, **rotation** à chaque usage et révocation de toute la
famille si un ancien jeton est rejoué (vol probable). Mots de passe en scrypt
(10 caractères minimum), 5 tentatives de connexion par minute. Chaque jeton
JWT porte une audience (`api`, `download`, `link`) : un jeton de
téléchargement ne peut pas servir de session, et inversement.

## Interface

- React 19, Vite, React Router, Tailwind CSS 4 ; pages chargées à la demande.
- Import : glisser-déposer sur toute la page, envois par lots de 20 avec une
  barre de progression par lot (`XMLHttpRequest`, car `fetch` ne mesure pas l'envoi).
- L'interface masque les actions interdites selon le rôle, mais **la sécurité
  est côté serveur** : chaque règle est revérifiée par l'API et couverte par un test.
- [React Bits](https://reactbits.dev) : LetterGlitch (fond hexadécimal de
  l'accueil), DecryptedText (titres, empreinte SHA-256 qui se « déchiffre »),
  ShinyText et SpotlightCard (adapté au thème).

## Limites connues et suites possibles

- Les fichiers ne sont pas chiffrés au repos : en production, on activerait le
  chiffrement du stockage (disque ou S3 avec SSE) plutôt que de le réinventer.
- Pas d'analyse antivirus des fichiers importés (ClamAV serait l'étape suivante).
- Pas de téléchargement d'un dossier entier en ZIP.
- Pas de corbeille : une suppression est définitive (l'interface le signale).
- Le limiteur de débit est en mémoire : à partager (Redis) avec plusieurs instances de l'API.
