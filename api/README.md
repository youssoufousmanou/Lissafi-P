# LISSAFI-P API

Backend Node.js/Express pour LISSAFI-P, une plateforme de gestion commerciale pensée pour les petits commerces et acteurs du secteur informel au Cameroun.

Le projet expose une API REST versionnée, avec authentification JWT, PostgreSQL pour les données métier, Redis pour le cache et quelques contrôles de limites liés aux plans `FREE` et `PRO`.

## Aperçu

- Authentification par OTP + mot de passe + JWT access/refresh
- Gestion des opérations commerciales
- Catalogue produits avec quotas plan `FREE`
- Mouvements de stock, alertes de seuil et valorisation
- Base PostgreSQL structurée pour les modules futurs : clients, visites, charges, rapports, boutique, abonnements
- Collections Postman fournies pour tester les modules déjà implémentés

## Stack technique

- `Node.js >= 18`
- `Express`
- `PostgreSQL`
- `Redis`
- `Joi`
- `Winston`
- `Jest`

## État du projet

Modules déjà utilisables :

- `Auth (M1)`
- `Operations (M2)`
- `Products (M3)`
- `Stock (M3)` : logique principale en place, notifications FCM encore différées

Modules encore en cours ou squelettiques :

- `Clients / Visits`
- `Charges`
- `Reports`
- `Boutique`
- `Subscriptions`

La feuille de route détaillée se trouve dans [LISSAFI-P_ROADMAP.md](/home/bounyamine/Documents/MesProjets/Lissafi/lissafi-api/LISSAFI-P_ROADMAP.md:1).

## Structure

```text
.
├── database/
│   └── lissafi_schema.sql
├── postman/
│   ├── LISSAFI-P_Auth.postman_collection.json
│   ├── LISSAFI-P_Operations_postman_collection.json
│   ├── LISSAFI-P_Products.postman_collection.json
│   ├── LISSAFI-P_Stock.postman_collection.json
│   └── LISSAFI-P_Local.postman_environment.json
├── src/
│   ├── app.js
│   ├── server.js
│   ├── config/
│   ├── middleware/
│   ├── modules/
│   ├── jobs/
│   └── utils/
└── package.json
```

## Démarrage local

### 1. Prérequis

- `Node.js 18+`
- `PostgreSQL 15+`
- `Redis`

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer l'environnement

```bash
cp .env.example .env
```

Renseigner au minimum :

- `PORT`
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `REDISHOST`, `REDISPORT`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`

En développement, les valeurs Twilio/Firebase/paiement peuvent rester vides si vous ne testez pas ces intégrations.

### 4. Initialiser la base de données

Le dépôt contient le schéma SQL complet dans [database/lissafi_schema.sql](/home/bounyamine/Documents/MesProjets/Lissafi/lissafi-api/database/lissafi_schema.sql:1).

Exemple avec `psql` :

```bash
psql -U lissafi_user -d lissafi_db -f database/lissafi_schema.sql
```

Note :
les scripts `npm run migrate` et `npm run seed` sont déclarés dans `package.json`, mais le bootstrap réellement versionné dans ce dépôt repose aujourd'hui sur le fichier SQL du dossier `database/`.

### 5. Lancer l'API

```bash
npm run dev
```

ou

```bash
npm start
```

API locale par défaut :

```text
http://localhost:3000/api/v1
```

Health check :

```text
GET http://localhost:3000/health
```

Documentation Swagger :

```text
http://localhost:3000/docs
```

Spec OpenAPI brute :

```text
http://localhost:3000/docs/openapi.json
```

## Scripts utiles

```bash
npm run dev
npm start
npm test
npm run test:unit
npm run test:int
npm run test:cov
npm run lint
npm run lint:fix
```

## Modules API

### Auth

Base route : `/api/v1/auth`

Fonctionnalités principales :

- inscription par téléphone ou email
- vérification OTP
- définition du mot de passe
- connexion
- refresh token
- profil utilisateur

### Operations

Base route : `/api/v1/operations`

Fonctionnalités principales :

- création d'opérations `VENTE`, `ACHAT`, `DEPENSE`, `RECETTE`
- listes paginées avec filtres
- résumés quotidiens et mensuels
- quota plan `FREE`

### Products

Base route : `/api/v1/products`

Fonctionnalités principales :

- création et mise à jour produit
- catalogue paginé
- détail produit
- désactivation logique
- quota de produits plan `FREE`

### Stock

Base route : `/api/v1/stock`

Fonctionnalités principales :

- enregistrement de mouvements `ENTREE`, `SORTIE`, `AJUSTEMENT`
- historique par produit
- alertes de rupture
- valorisation du stock

## Tests Postman

Le dossier [postman](/home/bounyamine/Documents/MesProjets/Lissafi/lissafi-api/postman:1) contient :

- l'environnement local `LISSAFI-P_Local.postman_environment.json`
- les collections `Auth`, `Operations`, `Products` et `Stock`

Ordre conseillé :

1. Importer l'environnement local.
2. Lancer la collection `Auth` pour obtenir les tokens.
3. Tester `Operations`, puis `Products`, puis `Stock`.

## Documentation API

Une documentation Swagger/OpenAPI est exposee directement par l'application :

- interface Swagger UI : `/docs`
- spec JSON OpenAPI : `/docs/openapi.json`

Le perimetre documente correspond aux modules actuellement implementes :

- `health`
- `auth`
- `operations`
- `products`
- `stock`

## Réponses API

Format de succès :

```json
{
  "success": true,
  "message": "Succès",
  "data": {}
}
```

Format d'erreur :

```json
{
  "success": false,
  "message": "Données invalides",
  "errors": []
}
```

## Sécurité et comportement

- `helmet` pour les headers HTTP
- `cors` configurable selon l'environnement
- rate limiting global et spécifique à l'auth
- hash de mot de passe avec `bcrypt`
- JWT access + refresh tokens
- arrêt gracieux du serveur et fermeture propre DB/Redis

## Limites connues

- Les notifications FCM côté stock ne sont pas encore branchées
- L'intégration Orange API SMS est encore en stub
- Plusieurs modules sont déjà montés dans `app.js` mais pas encore implémentés
- Le dépôt ne contient pas encore une suite de tests complète sur tous les modules

## Vision produit

LISSAFI-P API vise à fournir une base backend robuste pour :

- suivre ventes, achats, dépenses et recettes
- gérer un petit catalogue produit et le stock associé
- accompagner les créances clients et les rappels
- ouvrir la voie à une boutique en ligne et à un abonnement Pro

## Licence

Aucune licence n'est encore déclarée.
# lissafi-p-api
# lissafi-p-api
# lissafi-p-api
# lissafi-p-api
