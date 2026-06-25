-- =============================================================================
-- LISSAFI-P — Schéma PostgreSQL Complet
-- Version 1.0.0 | Université de Maroua — 2026
-- Backend: Node.js + Express | DB: PostgreSQL 15+
-- =============================================================================

-- Extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";    -- UUID auto-générés
CREATE EXTENSION IF NOT EXISTS "pgcrypto";     -- chiffrement natif

-- =============================================================================
-- SECTION 1 — TYPES ÉNUMÉRÉS (ENUMs)
-- Centralise toutes les valeurs fixes du domaine métier
-- =============================================================================

CREATE TYPE activity_type_enum AS ENUM (
  'COMMERCE_GENERAL',
  'MECANIQUE',
  'COUTURE',
  'COIFFURE',
  'ALIMENTATION',
  'AGRICULTURE',
  'SERVICES',
  'AUTRE'
);

CREATE TYPE plan_enum AS ENUM (
  'FREE',
  'PRO'
);

CREATE TYPE operation_type_enum AS ENUM (
  'VENTE',
  'ACHAT',
  'DEPENSE',
  'RECETTE'
);

CREATE TYPE movement_type_enum AS ENUM (
  'IN',          -- entrée de stock (achat fournisseur)
  'OUT',         -- sortie de stock (vente)
  'ADJUSTMENT'   -- ajustement manuel (inventaire)
);

CREATE TYPE visit_status_enum AS ENUM (
  'PAID',        -- payé intégralement
  'CREDIT',      -- entièrement à crédit
  'PARTIAL'      -- paiement partiel
);

CREATE TYPE debt_status_enum AS ENUM (
  'PENDING',     -- créance en attente (dans les délais)
  'LATE',        -- créance en retard (dépassé due_date)
  'PAID'         -- créance soldée
);

CREATE TYPE charge_frequency_enum AS ENUM (
  'MONTHLY',
  'QUARTERLY',
  'YEARLY'
);

CREATE TYPE charge_category_enum AS ENUM (
  'LOYER',
  'SALAIRES',
  'EAU_ELECTRICITE',
  'ABONNEMENT',
  'TAXES',
  'AUTRE'
);

CREATE TYPE subscription_status_enum AS ENUM (
  'ACTIVE',
  'EXPIRED',
  'CANCELLED',
  'PENDING'
);

CREATE TYPE payment_method_enum AS ENUM (
  'MTN_MOMO',
  'ORANGE_MONEY',
  'VIREMENT',
  'CARTE_BANCAIRE',
  'GRATUIT'          -- offre de lancement / 2 mois offerts
);

CREATE TYPE sms_status_enum AS ENUM (
  'PENDING',
  'SENT',
  'FAILED'
);

CREATE TYPE notification_type_enum AS ENUM (
  'STOCK_ALERT',         -- seuil de rupture atteint
  'CHARGE_REMINDER',     -- rappel charge fixe à venir
  'CLIENT_REMINDER',     -- relance créance client
  'SUBSCRIPTION_EXPIRY', -- abonnement Pro bientôt expiré
  'GENERAL'
);


-- =============================================================================
-- SECTION 2 — FONCTION UTILITAIRE updated_at
-- Trigger réutilisable sur toutes les tables avec updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- SECTION 3 — TABLE: users
-- Compte principal du commerçant
-- =============================================================================

CREATE TABLE users (
  id                UUID                 PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone             VARCHAR(20)          UNIQUE,
  email             VARCHAR(255)         UNIQUE,
  password_hash     VARCHAR(255)         NOT NULL,
  activity_type     activity_type_enum   NOT NULL DEFAULT 'COMMERCE_GENERAL',
  boutique_name     VARCHAR(150),
  address           VARCHAR(255),
  logo_url          VARCHAR(500),
  description       VARCHAR(500),
  work_hours_start  TIME,
  work_hours_end    TIME,
  plan              plan_enum            NOT NULL DEFAULT 'FREE',
  is_verified       BOOLEAN              NOT NULL DEFAULT FALSE,
  is_active         BOOLEAN              NOT NULL DEFAULT TRUE,
  last_login_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ          NOT NULL DEFAULT NOW(),

  -- Au moins un moyen de contact obligatoire
  CONSTRAINT chk_users_contact CHECK (
    phone IS NOT NULL OR email IS NOT NULL
  )
);

CREATE INDEX idx_users_phone  ON users(phone);
CREATE INDEX idx_users_email  ON users(email);
CREATE INDEX idx_users_plan   ON users(plan);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- =============================================================================
-- SECTION 4 — TABLE: otp_tokens
-- Codes OTP envoyés par SMS/email pour vérification du compte
-- Expire au bout de 10 minutes (cf. règle métier M1)
-- =============================================================================

CREATE TABLE otp_tokens (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        REFERENCES users(id) ON DELETE CASCADE,
  identifier  VARCHAR(255) NOT NULL,          -- numéro de téléphone ou email
  token       CHAR(6)     NOT NULL,
  is_used     BOOLEAN     NOT NULL DEFAULT FALSE,
  attempts    SMALLINT    NOT NULL DEFAULT 0  -- protection brute-force
                          CHECK (attempts <= 5),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_otp_identifier ON otp_tokens(identifier);
CREATE INDEX idx_otp_expires    ON otp_tokens(expires_at);


-- =============================================================================
-- SECTION 5 — TABLE: refresh_tokens
-- JWT long-durée pour renouveler les access tokens (15 min)
-- =============================================================================

CREATE TABLE refresh_tokens (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL UNIQUE,   -- hash SHA-256 du token brut
  device_info VARCHAR(255),                   -- user-agent du client
  ip_address  INET,
  is_revoked  BOOLEAN     NOT NULL DEFAULT FALSE,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_hash ON refresh_tokens(token_hash);


-- =============================================================================
-- SECTION 6 — TABLE: subscriptions
-- Historique des abonnements Pro (MTN MoMo, Orange Money, etc.)
-- =============================================================================

CREATE TABLE subscriptions (
  id                UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID                     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan              plan_enum                NOT NULL DEFAULT 'PRO',
  status            subscription_status_enum NOT NULL DEFAULT 'PENDING',
  payment_method    payment_method_enum,
  payment_reference VARCHAR(255),            -- référence transaction Mobile Money
  amount_paid       NUMERIC(12, 2)           CHECK (amount_paid >= 0),
  start_date        DATE                     NOT NULL,
  end_date          DATE                     NOT NULL,
  auto_renew        BOOLEAN                  NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ              NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ              NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_sub_dates CHECK (end_date > start_date)
);

CREATE INDEX idx_sub_user     ON subscriptions(user_id);
CREATE INDEX idx_sub_status   ON subscriptions(status);
CREATE INDEX idx_sub_end_date ON subscriptions(end_date);  -- pour cron expiration

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- =============================================================================
-- SECTION 7 — TABLE: products (Module M3)
-- Catalogue de produits et services du commerçant
-- Plan FREE : max 20 articles (contrôle applicatif)
-- =============================================================================

CREATE TABLE products (
  id              UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(200)   NOT NULL,
  description     VARCHAR(500),
  unit            VARCHAR(50)    NOT NULL DEFAULT 'pièce',   -- kg, L, m, pièce…
  purchase_price  NUMERIC(15, 2) NOT NULL DEFAULT 0
                                 CHECK (purchase_price >= 0),
  sale_price      NUMERIC(15, 2) NOT NULL DEFAULT 0
                                 CHECK (sale_price >= 0),
  stock_qty       NUMERIC(12, 3) NOT NULL DEFAULT 0
                                 CHECK (stock_qty >= 0),
  alert_threshold NUMERIC(12, 3) NOT NULL DEFAULT 5
                                 CHECK (alert_threshold >= 0),
  image_url       VARCHAR(500),
  is_service      BOOLEAN        NOT NULL DEFAULT FALSE,  -- service = pas de stock
  is_active       BOOLEAN        NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

  -- Avertissement si prix de vente < prix d'achat (règle métier M3)
  CONSTRAINT chk_sale_gte_purchase CHECK (
    is_service = TRUE OR sale_price >= purchase_price
  )
);

CREATE INDEX idx_products_user   ON products(user_id);
CREATE INDEX idx_products_active ON products(user_id, is_active);
CREATE INDEX idx_products_stock  ON products(user_id, stock_qty);

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- =============================================================================
-- SECTION 8 — TABLE: stock_movements (Module M3)
-- Journal immuable de tous les mouvements de stock
-- stock_after : snapshot du stock au moment du mouvement (audit trail)
-- =============================================================================

CREATE TABLE stock_movements (
  id            UUID                 PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id    UUID                 NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id       UUID                 NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  movement_type movement_type_enum   NOT NULL,
  quantity      NUMERIC(12, 3)       NOT NULL CHECK (quantity > 0),
  unit_price    NUMERIC(15, 2),
  reason        VARCHAR(255),
  operation_id  UUID,                -- lien optionnel vers operations (FK ajoutée après)
  mov_date      DATE                 NOT NULL DEFAULT CURRENT_DATE,
  stock_after   NUMERIC(12, 3)       NOT NULL,  -- valeur après mouvement pour audit
  created_at    TIMESTAMPTZ          NOT NULL DEFAULT NOW()
  -- Table immuable : pas de updated_at, pas de suppression logique
);

CREATE INDEX idx_stock_mov_product ON stock_movements(product_id);
CREATE INDEX idx_stock_mov_user    ON stock_movements(user_id);
CREATE INDEX idx_stock_mov_date    ON stock_movements(mov_date);


-- =============================================================================
-- SECTION 9 — TABLE: clients (Module M4)
-- Fichier clients du commerçant
-- Plan FREE : max 10 clients (contrôle applicatif)
-- =============================================================================

CREATE TABLE clients (
  id                  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                VARCHAR(150) NOT NULL,
  phone               VARCHAR(20),
  address             VARCHAR(255),
  notes               TEXT,
  total_purchases     NUMERIC(15, 2) NOT NULL DEFAULT 0
                                     CHECK (total_purchases >= 0),
  outstanding_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,  -- peut être négatif (avance)
  visit_count         INTEGER        NOT NULL DEFAULT 0
                                     CHECK (visit_count >= 0),
  is_active           BOOLEAN        NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_user    ON clients(user_id);
CREATE INDEX idx_clients_phone   ON clients(phone);
CREATE INDEX idx_clients_balance ON clients(user_id, outstanding_balance);  -- top débiteurs

CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- =============================================================================
-- SECTION 10 — TABLE: operations (Module M2)
-- Journal principal des transactions : ventes, achats, dépenses, recettes
-- Plan FREE : max 30 opérations/mois (contrôle applicatif)
-- =============================================================================

CREATE TABLE operations (
  id            UUID                  PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID                  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          operation_type_enum   NOT NULL,
  amount        NUMERIC(15, 2)        NOT NULL CHECK (amount > 0),
  article_name  VARCHAR(200),
  quantity      NUMERIC(10, 3)        DEFAULT 1 CHECK (quantity > 0),
  unit_price    NUMERIC(15, 2),
  description   VARCHAR(255),
  supplier_name VARCHAR(150),
  receipt_url   VARCHAR(500),
  op_date       DATE                  NOT NULL DEFAULT CURRENT_DATE,

  -- Liens optionnels vers d'autres entités
  product_id    UUID                  REFERENCES products(id) ON DELETE SET NULL,
  client_id     UUID                  REFERENCES clients(id)  ON DELETE SET NULL,

  created_at    TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_operations_user    ON operations(user_id);
CREATE INDEX idx_operations_type    ON operations(user_id, type);
CREATE INDEX idx_operations_date    ON operations(user_id, op_date DESC);
CREATE INDEX idx_operations_client  ON operations(client_id);
CREATE INDEX idx_operations_product ON operations(product_id);

-- Index partiel pour accélérer le compte mensuel (limite plan FREE)
CREATE INDEX idx_operations_monthly
  ON operations(user_id, EXTRACT(YEAR FROM op_date), EXTRACT(MONTH FROM op_date));

CREATE TRIGGER trg_operations_updated_at
  BEFORE UPDATE ON operations
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- FK croisée stock_movements -> operations (ajoutée après création de operations)
ALTER TABLE stock_movements
  ADD CONSTRAINT fk_stock_mov_operation
  FOREIGN KEY (operation_id) REFERENCES operations(id) ON DELETE SET NULL;


-- =============================================================================
-- SECTION 11 — TABLE: visits (Module M4)
-- Enregistrement des visites et créances clients
-- =============================================================================

CREATE TABLE visits (
  id          UUID               PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id   UUID               NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id     UUID               NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visit_date  DATE               NOT NULL DEFAULT CURRENT_DATE,
  object      VARCHAR(255),                         -- motif de la visite
  amount      NUMERIC(15, 2)     NOT NULL DEFAULT 0 CHECK (amount >= 0),
  amount_paid NUMERIC(15, 2)     NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  status      visit_status_enum  NOT NULL DEFAULT 'PAID',
  debt_status debt_status_enum   NOT NULL DEFAULT 'PAID',
  due_date    DATE,                                 -- date limite de remboursement
  notes       VARCHAR(500),
  created_at  TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ        NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_amount_paid_lte_amount CHECK (amount_paid <= amount),
  CONSTRAINT chk_due_date_if_credit CHECK (
    status = 'PAID' OR due_date IS NOT NULL
  )
);

CREATE INDEX idx_visits_client      ON visits(client_id);
CREATE INDEX idx_visits_user        ON visits(user_id);
CREATE INDEX idx_visits_debt_status ON visits(debt_status) WHERE debt_status != 'PAID';
CREATE INDEX idx_visits_due_date    ON visits(due_date) WHERE debt_status = 'PENDING';

CREATE TRIGGER trg_visits_updated_at
  BEFORE UPDATE ON visits
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- =============================================================================
-- SECTION 12 — TABLE: fixed_charges (Module M5)
-- Charges fixes récurrentes (loyer, salaires, eau, etc.)
-- =============================================================================

CREATE TABLE fixed_charges (
  id            UUID                   PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID                   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label         VARCHAR(150)           NOT NULL,
  category      charge_category_enum   NOT NULL DEFAULT 'AUTRE',
  amount        NUMERIC(15, 2)         NOT NULL CHECK (amount > 0),
  frequency     charge_frequency_enum  NOT NULL DEFAULT 'MONTHLY',
  next_due_date DATE                   NOT NULL,
  is_active     BOOLEAN                NOT NULL DEFAULT TRUE,
  notes         VARCHAR(255),
  created_at    TIMESTAMPTZ            NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ            NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_charges_user     ON fixed_charges(user_id);
CREATE INDEX idx_charges_due_date ON fixed_charges(next_due_date) WHERE is_active = TRUE;

CREATE TRIGGER trg_charges_updated_at
  BEFORE UPDATE ON fixed_charges
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- =============================================================================
-- SECTION 13 — TABLE: boutique (Module M7)
-- Vitrine en ligne publique — 1 boutique par utilisateur Pro
-- =============================================================================

CREATE TABLE boutique (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID         NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  slug            VARCHAR(100) NOT NULL UNIQUE,        -- ex: maroua-coiffure-djibo
  is_published    BOOLEAN      NOT NULL DEFAULT FALSE,
  banner_url      VARCHAR(500),
  primary_color   CHAR(7)      NOT NULL DEFAULT '#1A73E8',   -- couleur hex
  secondary_color CHAR(7)      NOT NULL DEFAULT '#FFFFFF',
  welcome_message VARCHAR(500),
  whatsapp_number VARCHAR(20),
  show_prices     BOOLEAN      NOT NULL DEFAULT TRUE,
  allow_orders    BOOLEAN      NOT NULL DEFAULT FALSE,        -- activé en V2
  qr_code_url     VARCHAR(500),
  total_views     INTEGER      NOT NULL DEFAULT 0 CHECK (total_views >= 0),
  total_clicks    INTEGER      NOT NULL DEFAULT 0 CHECK (total_clicks >= 0),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_boutique_slug    ON boutique(slug);
CREATE INDEX        idx_boutique_user    ON boutique(user_id);
CREATE INDEX        idx_boutique_public  ON boutique(is_published) WHERE is_published = TRUE;

CREATE TRIGGER trg_boutique_updated_at
  BEFORE UPDATE ON boutique
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- =============================================================================
-- SECTION 14 — TABLE: boutique_stats (Module M7)
-- Statistiques de visites journalières de la boutique publique
-- =============================================================================

CREATE TABLE boutique_stats (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  boutique_id UUID         NOT NULL REFERENCES boutique(id) ON DELETE CASCADE,
  stat_date   DATE         NOT NULL DEFAULT CURRENT_DATE,
  views       INTEGER      NOT NULL DEFAULT 0 CHECK (views >= 0),
  clicks      INTEGER      NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  source      VARCHAR(50)  NOT NULL DEFAULT 'DIRECT',  -- QR_CODE | LINK | SHARE | DIRECT

  UNIQUE (boutique_id, stat_date, source)
);

CREATE INDEX idx_boutique_stats_boutique ON boutique_stats(boutique_id);
CREATE INDEX idx_boutique_stats_date     ON boutique_stats(stat_date);


-- =============================================================================
-- SECTION 15 — TABLE: sms_logs
-- Traçabilité de tous les SMS envoyés (relances clients, OTP, etc.)
-- =============================================================================

CREATE TABLE sms_logs (
  id            UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id     UUID             REFERENCES clients(id) ON DELETE SET NULL,
  visit_id      UUID             REFERENCES visits(id)   ON DELETE SET NULL,
  recipient     VARCHAR(20)      NOT NULL,
  message       TEXT             NOT NULL,
  status        sms_status_enum  NOT NULL DEFAULT 'PENDING',
  provider      VARCHAR(50),                    -- TWILIO | ORANGE_API | etc.
  provider_ref  VARCHAR(255),                   -- ID de la transaction chez le provider
  error_message VARCHAR(500),
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ      NOT NULL DEFAULT NOW()
  -- Table de log : pas de suppression ni de modification
);

CREATE INDEX idx_sms_logs_user   ON sms_logs(user_id);
CREATE INDEX idx_sms_logs_client ON sms_logs(client_id);
CREATE INDEX idx_sms_logs_status ON sms_logs(status) WHERE status = 'PENDING';


-- =============================================================================
-- SECTION 16 — TABLE: notifications
-- Notifications push in-app (FCM) et centre de notifications
-- =============================================================================

CREATE TABLE notifications (
  id         UUID                    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID                    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       notification_type_enum  NOT NULL,
  title      VARCHAR(150)            NOT NULL,
  body       TEXT                    NOT NULL,
  data       JSONB,                             -- payload additionnel pour deep link
  is_read    BOOLEAN                 NOT NULL DEFAULT FALSE,
  sent_at    TIMESTAMPTZ,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_user    ON notifications(user_id);
CREATE INDEX idx_notif_unread  ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notif_type    ON notifications(type);


-- =============================================================================
-- SECTION 17 — VUES UTILITAIRES
-- Accélèrent les requêtes fréquentes du dashboard et des rapports
-- =============================================================================

-- Vue : solde par utilisateur (dashboard M6)
CREATE VIEW v_user_balance AS
SELECT
  user_id,
  SUM(CASE WHEN type IN ('VENTE', 'RECETTE') THEN amount ELSE 0 END) AS total_entrees,
  SUM(CASE WHEN type IN ('ACHAT', 'DEPENSE') THEN amount ELSE 0 END) AS total_sorties,
  SUM(CASE WHEN type IN ('VENTE', 'RECETTE') THEN amount
           WHEN type IN ('ACHAT', 'DEPENSE')  THEN -amount
           ELSE 0 END)                                                 AS solde
FROM operations
GROUP BY user_id;

-- Vue : créances clients en retard (dashboard M4)
CREATE VIEW v_overdue_debts AS
SELECT
  v.id          AS visit_id,
  v.user_id,
  c.id          AS client_id,
  c.name        AS client_name,
  c.phone       AS client_phone,
  v.amount - v.amount_paid AS montant_du,
  v.due_date,
  CURRENT_DATE - v.due_date AS jours_retard
FROM visits v
JOIN clients c ON c.id = v.client_id
WHERE v.debt_status = 'LATE'
  AND v.amount > v.amount_paid;

-- Vue : valorisation du stock par utilisateur
CREATE VIEW v_stock_valuation AS
SELECT
  user_id,
  COUNT(*)                                              AS nb_produits,
  SUM(stock_qty * purchase_price)                       AS valeur_achat,
  SUM(stock_qty * sale_price)                           AS valeur_vente,
  SUM(stock_qty * (sale_price - purchase_price))        AS marge_brute_theorique
FROM products
WHERE is_active = TRUE AND is_service = FALSE
GROUP BY user_id;

-- Vue : alertes de rupture de stock
CREATE VIEW v_stock_alerts AS
SELECT
  p.id          AS product_id,
  p.user_id,
  p.name,
  p.stock_qty,
  p.alert_threshold,
  p.unit
FROM products p
WHERE p.is_active = TRUE
  AND p.is_service = FALSE
  AND p.stock_qty <= p.alert_threshold;


-- =============================================================================
-- SECTION 18 — COMMENTAIRES DE DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE users           IS 'Comptes des commerçants — nœud central du schéma';
COMMENT ON TABLE otp_tokens      IS 'Codes OTP SMS/email — expiration 10 min — règle métier M1';
COMMENT ON TABLE refresh_tokens  IS 'Jetons JWT long-durée — révocables par appareil';
COMMENT ON TABLE subscriptions   IS 'Historique des abonnements Pro — MTN MoMo / Orange Money';
COMMENT ON TABLE products        IS 'Catalogue produits/services — FREE: 20 max — PRO: illimité';
COMMENT ON TABLE stock_movements IS 'Journal immuable des mouvements de stock (audit trail)';
COMMENT ON TABLE clients         IS 'Fichier clients — FREE: 10 max — PRO: illimité';
COMMENT ON TABLE operations      IS 'Transactions commerciales — FREE: 30/mois — PRO: illimité';
COMMENT ON TABLE visits          IS 'Visites et créances clients avec suivi de dette';
COMMENT ON TABLE fixed_charges   IS 'Charges fixes récurrentes (loyer, salaires, eau…)';
COMMENT ON TABLE boutique        IS 'Vitrine publique en ligne — PRO uniquement — 1 par user';
COMMENT ON TABLE boutique_stats  IS 'Statistiques de visites journalières de la boutique';
COMMENT ON TABLE sms_logs        IS 'Log immuable de tous les SMS envoyés (relances, OTP)';
COMMENT ON TABLE notifications   IS 'Notifications push FCM et centre de notifications in-app';

-- =============================================================================
-- FIN DU SCHÉMA — LISSAFI-P v1.0.0
-- Limites plan FREE gérées côté applicatif (middleware Node.js)
-- Toutes les monnaies en FCFA (XAF) — NUMERIC(15,2)
-- Tous les timestamps en TIMESTAMPTZ (UTC)
-- =============================================================================
