# 🚀 Guide de Configuration Railway pour LISSAFI-P

## 1. Ajouter PostgreSQL à votre projet Railway

### Étapes :
1. Allez à https://railway.app/dashboard
2. Sélectionnez votre projet **lissafi-p-api**
3. Cliquez sur **"+ Create"** en haut à droite
4. Cherchez **"PostgreSQL"** et cliquez dessus
5. Railway crée automatiquement une instance et ajoute les variables

### Variables créées automatiquement par Railway
Railway ajoute ces variables d'environnement pour PostgreSQL :
```
DATABASE_URL              # URL complète de connexion (ex: postgresql://user:pass@host:port/db)
PGHOST                    # Hostname
PGPORT                    # Port (5432)
PGUSER                    # Username
PGPASSWORD                # Password
PGDATABASE                # Database name
```

---

## 2. Ajouter Redis à votre projet (optionnel mais recommandé)

### Étapes similaires :
1. **"+ Create"** > **"Redis"**
2. Railway crée les variables :
```
REDIS_URL                 # URL complète (ex: redis://default:pass@host:port)
REDIS_HOST
REDIS_PORT
REDIS_PASSWORD
```

---

## 3. Configurer les variables manquelles dans Railway Dashboard

### Aller aux Variables du projet
1. Dans le projet LISSAFI-P, cliquez sur **"Variables"** (ou l'icône 🔐)
2. Vous verrez les variables automatiques de PostgreSQL et Redis
3. **Ajouter manuellement** :

| Variable | Valeur | Source |
|----------|--------|--------|
| `NODE_ENV` | `production` | Fixe |
| `PORT` | `3000` | Fixe (Railway assigne le PORT réel) |
| `API_VERSION` | `v1` | Fixe |
| `APP_NAME` | `LISSAFI-P` | Fixe |
| `BASE_URL` | `https://lissafi-p-api.up.railway.app` | À adapter avec votre domaine |
| `DB_SSL` | `true` | Fixe pour production |
| `DB_POOL_MIN` | `2` | Fixe |
| `DB_POOL_MAX` | `20` | Fixe |
| `JWT_ACCESS_SECRET` | (64+ caractères aléatoires) | **À générer** |
| `JWT_REFRESH_SECRET` | (64+ caractères aléatoires) | **À générer** |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Fixe |
| `JWT_REFRESH_EXPIRES_IN` | `30d` | Fixe |
| `TWILIO_ACCOUNT_SID` | Voir `.env.railway` | Votre compte Twilio |
| `TWILIO_AUTH_TOKEN` | Voir `.env.railway` | Votre compte Twilio |
| `TWILIO_PHONE_NUMBER` | Voir `.env.railway` | Votre compte Twilio |
| `OTP_EXPIRES_MINUTES` | `10` | Fixe |
| `OTP_MAX_ATTEMPTS` | `5` | Fixe |
| `FIREBASE_*` | Voir `.env.railway` | Firebase Console |
| `STORAGE_PROVIDER` | `cloudflare_r2` | Fixe ou `aws_s3` |
| `S3_*` | Voir `.env.railway` | Votre fournisseur cloud |
| `BCRYPT_ROUNDS` | `12` | Fixe |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Fixe |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Fixe |
| `RATE_LIMIT_AUTH_MAX` | `10` | Fixe |
| `LOG_LEVEL` | `info` | Fixe |
| `FREE_MAX_OPERATIONS_PER_MONTH` | `30` | Fixe |
| `FREE_MAX_PRODUCTS` | `20` | Fixe |
| `FREE_MAX_CLIENTS` | `10` | Fixe |
| `FREE_MAX_SMS_PER_MONTH` | `0` | Fixe |
| `PRO_MAX_SMS_PER_MONTH` | `20` | Fixe |

---

## 4. Générer les secrets JWT

Exécutez cette commande **2 fois** localement :
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copier les 2 résultats dans :
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`

---

## 5. Initialiser le schéma PostgreSQL

Une fois PostgreSQL ajouté, exécutez le schéma SQL :

### Option A : Via Railway CLI
```bash
# 1. Installer Railway CLI
npm install -g @railway/cli

# 2. Se connecter
railway login

# 3. Lier votre projet
railway link

# 4. Exécuter le schéma
railway run psql < database/lissafi_schema.sql
```

### Option B : Via pgAdmin ou DBeaver
1. Téléchargez [pgAdmin](https://www.pgadmin.org/) ou [DBeaver](https://dbeaver.io/)
2. Connectez-vous avec `DATABASE_URL` (voir Variables de Railway)
3. Exécutez le contenu du fichier `database/lissafi_schema.sql`

---

## 6. Vérifier que tout est configuré

Avant redéploiement, dans le Dashboard Railway, les variables doivent montrer :

✅ PostgreSQL variables (`PGHOST`, `PGPORT`, etc.)
✅ Redis variables (`REDIS_HOST`, `REDIS_PORT`, etc.)
✅ Vos 5 variables critiques (`JWT_*`, `TWILIO_*`, `DB_PASSWORD`, etc.)

---

## 7. Redéployer

1. Faites un nouveau commit :
   ```bash
   git add .
   git commit -m "feat: configure Railway environment"
   git push
   ```

2. Railway redéploiera automatiquement
3. Allez dans **"Deployments"** pour voir les logs en temps réel

---

## 🔍 Si ça ne marche toujours pas

1. **Vérifiez les logs** : Cliquez sur le dernier déploiement → **"View logs"**
2. **Vous cherchez** : `PostgreSQL ✓` et `Redis ✓` et `LISSAFI-P API démarrée`
3. **Si erreur** : Le message d'erreur détaillé devrait maintenant s'afficher

---

## ⚠️ Sécurité

- **Ne jamais** committer `.env` ou `.env.railway` dans Git
- `node_modules/` et `logs/` doivent être dans `.gitignore`
- Les secrets (JWT, DB_PASSWORD) doivent **uniquement** être dans Railway Variables, pas dans le code

