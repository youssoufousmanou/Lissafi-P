# LISSAFI-P — Feuille de route Backend complète
**Node.js + Express + PostgreSQL + Redis**
Version 1.0.0 | Université de Maroua — 2026

---

## Légende
- [ ] À faire
- [x] Terminé
- 🔴 Critique (bloquant pour la suite)
- 🟡 Important (nécessaire pour le MVP)
- 🟢 Optionnel (Phase 2+)

---

## ✅ PHASE 0 — Infrastructure (TERMINÉE)

- [x] Structure des dossiers du projet
- [x] `package.json` avec toutes les dépendances
- [x] `.env.example` — template de configuration
- [x] `.gitignore`
- [x] `src/config/env.js` — validation et chargement des variables d'env
- [x] `src/config/db.js` — pool PostgreSQL avec `query()` et `transaction()`
- [x] `src/config/redis.js` — client Redis avec helpers et préfixes de clés
- [x] `src/utils/logger.js` — Winston structuré (dev + prod)
- [x] `src/utils/response.js` — helpers HTTP standardisés
- [x] `src/app.js` — Express avec Helmet, CORS, Rate limiting, Morgan
- [x] `src/server.js` — démarrage + arrêt gracieux (SIGTERM/SIGINT)
- [x] `src/jobs/scheduler.js` — planificateur de tâches cron
- [x] Schéma PostgreSQL complet (14 tables, 4 vues, ENUMs, triggers)
- [x] Base de données créée et opérationnelle
- [x] Serveur démarré avec succès ✓

---

## ✅ ÉTAPE 1 — Module AUTH (M1) — TERMINÉE

> Priorité absolue — tous les autres modules en dépendent

### 1.1 Validator
- [x] `src/modules/auth/auth.validator.js`
  - [x] Schéma `registerSchema` — phone/email + type activité
  - [x] Schéma `verifyOtpSchema` — identifier + token 6 chiffres
  - [x] Schéma `setPasswordSchema` — userId UUID + password 4 chiffres
  - [x] Schéma `loginSchema` — phone/email + mot de passe
  - [x] Schéma `refreshTokenSchema` — refreshToken
  - [x] Schéma `logoutSchema` — refreshToken
  - [x] Schéma `resendOtpSchema` — identifier
  - [x] Schéma `updateProfileSchema` — champs profil optionnels
  - [x] Schéma `changePasswordSchema` — current + new (doivent être différents)
  - [x] Middleware `validate(schema)` — réutilisable sur toutes les routes

### 1.2 Service
- [x] `src/modules/auth/auth.service.js`
  - [x] `register(data)` — créer user + générer OTP + insérer otp_tokens
  - [x] `verifyOtp(identifier, token)` — vérifier + marquer is_used + is_verified
  - [x] `setPassword(userId, password)` — définir mdp + session automatique
  - [x] `login(identifier, password)` — bcrypt.compare + générer access/refresh JWT
  - [x] `refreshAccessToken(token)` — vérifier hash + émettre nouvel access token
  - [x] `logout(userId, tokenHash)` — révoquer refresh token en DB
  - [x] `getProfile(userId)` — SELECT user sans password_hash
  - [x] `updateProfile(userId, data)` — UPDATE champs profil
  - [x] `changePassword(userId, current, new)` — vérifier + changer + révoquer sessions
  - [x] `resendOtp(identifier)` — invalider anciens + générer + envoyer nouveau

### 1.3 Middleware
- [x] `src/middleware/authenticate.js`
  - [x] `authenticate` — vérifier Bearer JWT + attacher req.user
  - [x] `authenticateOptional` — JWT optionnel (routes publiques enrichies)
  - [x] `requirePro` — vérifier req.user.plan === 'PRO' sinon 403

### 1.4 Controller
- [x] `src/modules/auth/auth.controller.js`
  - [x] `register(req, res)` — POST /register
  - [x] `verifyOtp(req, res)` — POST /verify-otp
  - [x] `setPassword(req, res)` — POST /set-password
  - [x] `login(req, res)` — POST /login
  - [x] `refreshToken(req, res)` — POST /refresh
  - [x] `logout(req, res)` — POST /logout
  - [x] `resendOtp(req, res)` — POST /resend-otp
  - [x] `getProfile(req, res)` — GET /me
  - [x] `updateProfile(req, res)` — PATCH /me
  - [x] `changePassword(req, res)` — PATCH /me/password

### 1.5 Routes
- [x] `src/modules/auth/auth.routes.js`
  - [x] POST `/register` → otpRateLimiter + validator + controller
  - [x] POST `/verify-otp` → otpRateLimiter + validator + controller
  - [x] POST `/set-password` → validator + controller
  - [x] POST `/login` → loginRateLimiter + validator + controller
  - [x] POST `/refresh` → validator + controller
  - [x] POST `/logout` → authenticate + validator + controller
  - [x] POST `/resend-otp` → otpRateLimiter + validator + controller
  - [x] GET `/me` → authenticate + controller
  - [x] PATCH `/me` → authenticate + validator + controller
  - [x] PATCH `/me/password` → authenticate + validator + controller

### 1.6 Utilitaires Auth
- [x] `src/utils/otp.js` — génération + envoi OTP (mock en dev, Twilio en prod)
- [x] `src/utils/jwt.js` — sign/verify access et refresh tokens
- [ ] `src/utils/sms.js` — intégration Orange API Cameroun ⚠️ *stub non implémenté — fallback Twilio uniquement*

### ⚠️ Points restants après les tests Postman
> Ces éléments ne bloquent pas l'Étape 2 mais devront être complétés

- [ ] **Orange API SMS** `src/utils/sms.js` — intégration à faire en Phase 2 (Twilio suffit pour le MVP)
- [ ] **Upload logo profil** `PATCH /auth/me` — endpoint prévu, champ `logo_url` en DB, mais middleware `upload.js` pas encore fait (Étape 10)

---

## 🔴 ÉTAPE 2 — Module OPERATIONS (M2)

> Cœur métier — ventes, achats, dépenses, recettes

### 2.1 Validator
- [x] `src/modules/operations/operations.validator.js`
  - [x] `createOperationSchema` — type, amount, article_name, op_date...
  - [x] `updateOperationSchema` — tous les champs optionnels
  - [x] `listOperationsSchema` — filtres : type, date_from, date_to, page, limit

### 2.2 Service
- [x] `src/modules/operations/operations.service.js`
  - [x] `createOperation(userId, data)` — INSERT + vérifier limite FREE 30/mois
  - [x] `getOperations(userId, filters)` — SELECT paginé avec filtres
  - [x] `getOperationById(userId, id)` — SELECT one + vérifier ownership
  - [x] `updateOperation(userId, id, data)` — UPDATE + vérifier ownership
  - [x] `deleteOperation(userId, id)` — DELETE + vérifier ownership
  - [x] `getDailySummary(userId, date)` — solde du jour
  - [x] `getMonthlySummary(userId, year, month)` — total ventes/achats/dépenses
  - [x] `checkMonthlyLimit(userId)` — Redis COUNT pour plan FREE

### 2.3 Controller + Routes
- [x] `src/modules/operations/operations.controller.js`
  - [x] GET `/` — liste paginée avec filtres
  - [x] POST `/` — créer une opération
  - [x] GET `/summary/daily` — solde journalier
  - [x] GET `/summary/monthly` — résumé mensuel
  - [x] GET `/:id` — détail d'une opération
  - [x] PUT `/:id` — modifier
  - [x] DELETE `/:id` — supprimer
- [x] `src/modules/operations/operations.routes.js`
  - [x] Toutes les routes → authenticate + validator + controller

---

## 🔴 ÉTAPE 3 — Module PRODUCTS & STOCK (M3) — QUASI TERMINÉE

> Catalogue produits + journal des mouvements

### 3.1 Products
- [x] `src/modules/products/products.validator.js`
  - [x] `createProductSchema` — name, unit, purchase_price, sale_price...
  - [x] `updateProductSchema`
  - [x] `listProductsSchema` — filtres, pagination
- [x] `src/modules/products/products.service.js`
  - [x] `createProduct(userId, data)` — vérifier limite FREE 20 articles
  - [x] `getProducts(userId, filters)` — liste avec valorisation
  - [x] `getProductById(userId, id)`
  - [x] `updateProduct(userId, id, data)`
  - [x] `deleteProduct(userId, id)` — soft delete (is_active = false)
  - [x] `checkProductsLimit(userId)` — Redis COUNT plan FREE
- [x] Controller + Routes Products
  - [x] GET `/` — catalogue
  - [x] POST `/` — créer produit
  - [x] GET `/:id`
  - [x] PUT `/:id`
  - [x] DELETE `/:id`

### 3.2 Stock
- [x] `src/modules/stock/stock.validator.js`
  - [x] `createMovementSchema` — product_id, movement_type, quantity, reason
  - [x] `listMovementsSchema` — filtres, pagination
- [ ] `src/modules/stock/stock.service.js`
  - [x] `createMovement(userId, data)` — dispatcher ENTREE / SORTIE / AJUSTEMENT
  - [x] `addStock(userId, data)` — entrée + UPDATE products.stock_qty (transaction)
  - [x] `removeStock(userId, data)` — sortie + vérifier stock >= 0
  - [x] `adjustStock(userId, data)` — inventaire manuel
  - [x] `getMovements(userId, productId, filters)` — historique du produit
  - [x] `getAlerts(userId)` — produits sous seuil
  - [x] `getValuation(userId)` — valorisation totale du stock
  - [ ] `sendStockAlertNotification(userId, product)` — FCM push ⚠️ *différé à l'Étape 10 (Firebase)*
- [x] Controller + Routes Stock
  - [x] POST `/movement` — enregistrer mouvement
  - [x] GET `/movements/:productId` — historique
  - [x] GET `/alerts` — alertes de rupture
  - [x] GET `/valuation` — valorisation totale

---

## 🟡 ÉTAPE 4 — Module CLIENTS & VISITES (M4)

> Fichier clients + créances + relances SMS

### 4.1 Clients
- [ ] `src/modules/clients/clients.validator.js`
  - [ ] `createClientSchema` — name, phone, address, notes
  - [ ] `updateClientSchema`
- [ ] `src/modules/clients/clients.service.js`
  - [ ] `createClient(userId, data)` — vérifier limite FREE 10 clients
  - [ ] `getClients(userId, filters)` — liste avec outstanding_balance
  - [ ] `getClientById(userId, id)`
  - [ ] `updateClient(userId, id, data)`
  - [ ] `deleteClient(userId, id)` — soft delete
  - [ ] `getTopClients(userId, limit)` — classement par CA
  - [ ] `checkClientsLimit(userId)`
- [ ] Controller + Routes Clients
  - [ ] GET `/` — liste clients
  - [ ] POST `/` — créer client
  - [ ] GET `/top` — top clients (PRO)
  - [ ] GET `/:id` — fiche client
  - [ ] PUT `/:id` — modifier
  - [ ] DELETE `/:id`

### 4.2 Visites & Créances
- [ ] `src/modules/visits/visits.validator.js`
  - [ ] `createVisitSchema` — client_id, amount, amount_paid, status, due_date
  - [ ] `updateVisitSchema`
- [ ] `src/modules/visits/visits.service.js`
  - [ ] `createVisit(userId, data)` — INSERT + UPDATE clients.outstanding_balance
  - [ ] `getVisits(userId, filters)` — liste + filtre par client/statut
  - [ ] `updateVisit(userId, id, data)` — mettre à jour + recalculer balance
  - [ ] `markAsPaid(userId, visitId)` — solde la créance
  - [ ] `getOverdueDebts(userId)` — v_overdue_debts
  - [ ] `markOverdueDebts()` — JOB CRON — passer PENDING → LATE
  - [ ] `sendDebtReminders()` — JOB CRON — SMS relance (PRO)
  - [ ] `sendReminder(userId, visitId)` — envoi SMS manuel
- [ ] Controller + Routes Visits
  - [ ] GET `/` — liste visites
  - [ ] POST `/` — créer visite
  - [ ] GET `/overdue` — créances en retard
  - [ ] PUT `/:id` — modifier
  - [ ] PATCH `/:id/pay` — marquer payé
  - [ ] POST `/:id/remind` — envoyer relance SMS (PRO)

---

## 🟡 ÉTAPE 5 — Module CHARGES FIXES (M5)

- [ ] `src/modules/charges/charges.validator.js`
  - [ ] `createChargeSchema` — label, category, amount, frequency, next_due_date
  - [ ] `updateChargeSchema`
- [ ] `src/modules/charges/charges.service.js`
  - [ ] `createCharge(userId, data)`
  - [ ] `getCharges(userId)` — liste avec prochaines échéances
  - [ ] `updateCharge(userId, id, data)`
  - [ ] `deleteCharge(userId, id)` — soft delete
  - [ ] `calculateNextDueDate(frequency, currentDate)` — calcul automatique
  - [ ] `sendChargeReminders()` — JOB CRON — notif J-3 avant échéance
  - [ ] `getTotalMonthlyCharges(userId)` — impact sur bénéfice net
- [ ] Controller + Routes Charges
  - [ ] GET `/` — liste charges
  - [ ] POST `/` — créer charge
  - [ ] PUT `/:id`
  - [ ] DELETE `/:id`
  - [ ] GET `/summary` — total par catégorie + impact bénéfice

---

## 🟡 ÉTAPE 6 — Module RAPPORTS & DASHBOARD (M6)

- [ ] `src/modules/reports/reports.service.js`
  - [ ] `getDashboard(userId)` — agrégation temps réel (v_user_balance)
  - [ ] `getMonthlyReport(userId, year, month)` — toutes les opérations du mois
  - [ ] `getAnnualReport(userId, year)` — comparatif 12 mois
  - [ ] `getPeriodComparison(userId, period1, period2)` — comparaison deux périodes
  - [ ] `getMarginRate(userId, period)` — taux de marge
  - [ ] `getStockRotation(userId)` — rotation des stocks
  - [ ] `getRecoveryRate(userId)` — taux de recouvrement
  - [ ] `generatePdfReport(userId, year, month)` — PDF avec PDFKit
  - [ ] `generateExcelExport(userId, filters)` — Excel avec ExcelJS
  - [ ] `cacheDashboard(userId, data)` — mise en cache Redis 5min
- [ ] Controller + Routes Reports
  - [ ] GET `/dashboard` — tableau de bord (cache Redis)
  - [ ] GET `/monthly` — rapport mensuel
  - [ ] GET `/annual` — rapport annuel (PRO)
  - [ ] GET `/compare` — comparaison périodes (PRO)
  - [ ] GET `/indicators` — KPIs (PRO)
  - [ ] GET `/export/pdf` — télécharger PDF (PRO)
  - [ ] GET `/export/excel` — télécharger Excel (PRO)

---

## 🟢 ÉTAPE 7 — Module BOUTIQUE EN LIGNE (M7)

- [ ] `src/modules/boutique/boutique.validator.js`
  - [ ] `createBoutiqueSchema` — slug, welcome_message, colors, whatsapp
  - [ ] `updateBoutiqueSchema`
- [ ] `src/modules/boutique/boutique.service.js`
  - [ ] `createBoutique(userId, data)` — vérifier plan PRO
  - [ ] `getBoutique(userId)` — fiche boutique du commerçant
  - [ ] `updateBoutique(userId, data)` — personnalisation
  - [ ] `publishBoutique(userId)` — is_published = true
  - [ ] `getPublicBoutique(slug)` — page publique SANS auth
  - [ ] `generateQrCode(slug)` — générer QR code avec la lib `qrcode`
  - [ ] `generateSlug(boutiqueName)` — slugify unique
  - [ ] `trackView(boutiqueId, source)` — incrémenter stats
  - [ ] `getStats(userId)` — vues + clics par jour
- [ ] Controller + Routes Boutique
  - [ ] POST `/` — créer boutique (PRO)
  - [ ] GET `/` — ma boutique
  - [ ] PUT `/` — modifier
  - [ ] POST `/publish` — publier
  - [ ] GET `/qrcode` — télécharger QR code
  - [ ] GET `/stats` — statistiques de visite
  - [ ] GET `/public/:slug` — page publique (sans auth)

---

## 🟢 ÉTAPE 8 — Module ABONNEMENTS (M8)

- [ ] `src/modules/subscriptions/subscriptions.service.js`
  - [ ] `upgradeToPro(userId, data)` — initier paiement MTN MoMo
  - [ ] `confirmPayment(userId, paymentRef)` — vérifier paiement + activer PRO
  - [ ] `getCurrentSubscription(userId)` — abonnement actif
  - [ ] `getHistory(userId)` — historique des paiements
  - [ ] `expireSubscriptions()` — JOB CRON — expirer les abos dépassés
  - [ ] `cancelSubscription(userId)` — annuler renouvellement
  - [ ] `applyLaunchOffer(userId)` — 2 mois offerts (300 premiers)
- [ ] `src/utils/payment.js`
  - [ ] `initMtnMomoPay(amount, phone, ref)` — API MTN MoMo
  - [ ] `initOrangePay(amount, phone, ref)` — API Orange Money
  - [ ] `verifyPayment(provider, ref)` — vérifier statut
- [ ] Controller + Routes Subscriptions
  - [ ] POST `/upgrade` — passer au plan PRO
  - [ ] POST `/confirm` — confirmer paiement (webhook)
  - [ ] GET `/current` — abonnement actif
  - [ ] GET `/history` — historique
  - [ ] POST `/cancel` — annuler

---

## 🟢 ÉTAPE 9 — Notifications Push (FCM)

- [ ] `src/utils/notifications.js`
  - [ ] Initialiser Firebase Admin SDK
  - [ ] `sendPush(userId, title, body, data)` — envoyer une notification
  - [ ] `saveNotification(userId, type, title, body)` — persister en DB
  - [ ] `getNotifications(userId)` — liste des notifications
  - [ ] `markAsRead(userId, notifId)` — marquer lu
- [ ] Routes notifications
  - [ ] GET `/notifications` — liste
  - [ ] PATCH `/notifications/:id/read` — marquer lu
  - [ ] PATCH `/notifications/read-all` — tout marquer lu

---

## 🟢 ÉTAPE 10 — Upload Fichiers (S3/R2)

- [ ] `src/utils/storage.js`
  - [ ] `uploadFile(buffer, key, mimeType)` — upload vers S3/R2
  - [ ] `deleteFile(key)` — supprimer un fichier
  - [ ] `getSignedUrl(key)` — URL temporaire sécurisée
- [ ] Middleware `src/middleware/upload.js`
  - [ ] Multer configuré (limite 5MB, types autorisés : jpg/png/pdf)
  - [ ] Validation MIME type
- [ ] Intégration dans les modules
  - [ ] Upload logo utilisateur (PATCH /auth/me)
  - [ ] Upload photo reçu sur une opération
  - [ ] Upload photo produit (catalogue)
  - [ ] Upload bannière boutique

---

## 🟢 ÉTAPE 11 — Sécurité avancée

- [ ] Protection brute-force OTP (max 5 tentatives → Redis) *(rate limiter IP déjà en place, manque le compteur par identifier)*
- [ ] Rotation automatique des refresh tokens
- [ ] Blacklist des tokens révoqués (Redis SET)
- [ ] Headers sécurité renforcés (Helmet CSP)
- [ ] Validation UUID sur tous les paramètres `:id`
- [ ] Sanitisation des entrées (strip tags, trim)
- [ ] Logs d'audit (connexions, actions critiques)
- [ ] Tests de pénétration OWASP Top 10

---

## 🟢 ÉTAPE 12 — Tests complets

- [ ] `tests/unit/` — couverture ≥ 70% code métier
- [ ] Auth — unitaires (service + validator + middleware)
- [ ] `tests/integration/auth.routes.test.js` *(DB de test requise)*
- [ ] `tests/integration/` — 100% des endpoints documentés
- [ ] `tests/e2e/` — parcours critiques avec Supertest
  - [ ] Parcours inscription → vérification OTP → connexion
  - [ ] Parcours créer vente → stock mis à jour → dashboard
  - [ ] Parcours client → visite crédit → relance SMS
  - [ ] Parcours upgrade PRO → boutique activée

---

## 🟢 ÉTAPE 13 — Migrations & Seeds

- [ ] `migrations/runner.js` — exécuteur de migrations (up/down)
- [ ] `migrations/001_initial_schema.sql` — schéma initial
- [ ] `migrations/002_add_indexes.sql` — index de performance
- [ ] `seeds/runner.js` — chargeur de données de test
- [ ] `seeds/01_users.js` — utilisateurs de test
- [ ] `seeds/02_operations.js` — opérations de test
- [ ] `seeds/03_products.js` — catalogue de test

---

## 🟢 ÉTAPE 14 — Déploiement

- [ ] `Dockerfile` — conteneur Node.js optimisé
- [ ] `docker-compose.yml` — Node + PostgreSQL + Redis
- [ ] `.github/workflows/ci.yml` — GitHub Actions (lint + tests)
- [ ] `.github/workflows/deploy.yml` — déploiement automatique
- [ ] Variables d'env configurées sur Railway/Render
- [ ] Monitoring Sentry (erreurs production)
- [ ] Monitoring UptimeRobot (disponibilité)
- [ ] Documentation API Postman (collection partagée) *(Auth déjà documentée ✓)*

---

## Ordre de priorité recommandé

```
ÉTAPE 1 (Auth)        ✅ TERMINÉE
    ↓
ÉTAPE 2 (Operations)  ✅ TERMINÉE
    ↓
ÉTAPE 3 (Stock)       ✅ Quasi terminée (FCM différé Étape 10)
    ↓
ÉTAPE 4 (Clients)     ← prochaine étape MVP Phase 2
    ↓
ÉTAPE 5 (Charges)     ← MVP Phase 2
    ↓
ÉTAPE 6 (Rapports)    ← Phase 3
    ↓
ÉTAPE 7 (Boutique)    ← Phase 4
    ↓
ÉTAPE 8 (Paiement)    ← Phase 4
    ↓
ÉTAPES 9-14           ← Phase 5
```

---

## Compteur de progression

| Module | Fichiers | Statut |
|--------|----------|--------|
| Infrastructure | 10/10 | ✅ Terminé |
| Auth | 7/7 | ✅ Terminé (2 points en suspens) |
| Operations | 4/4 | ✅ Terminé |
| Products/Stock | 5/6 | ✅ Quasi terminé (FCM stock différé Étape 10) |
| Clients/Visits | 0/6 | ⬜ À faire |
| Charges | 0/4 | ⬜ À faire |
| Rapports | 0/4 | ⬜ À faire |
| Boutique | 0/4 | ⬜ À faire |
| Abonnements | 0/4 | ⬜ À faire |
| Notifications | 0/2 | ⬜ À faire |
| Upload | 0/2 | ⬜ À faire |
| Sécurité | 0/8 | ⬜ À faire |
| Migrations | 0/6 | ⬜ À faire |
| Déploiement | 0/8 | ⬜ À faire |

---

*Dernière mise à jour : 04 Mai 2026 — LISSAFI-P v1.0.0*
