'use strict';

/**
 * Configuration centralisée de l'environnement.
 *
 * Ce module charge .env via dotenv, valide les variables obligatoires
 * et exporte un objet de config typé et immuable.
 *
 * Pattern : fail-fast au démarrage si une variable critique est manquante.
 * Cela évite des erreurs cryptiques au runtime en production.
 */

require('dotenv').config();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Récupère une variable d'env obligatoire.
 * Lève une erreur au démarrage si elle est absente ou vide.
 */
function required(key) {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(`[Config] Variable d'environnement manquante : ${key}`);
  }
  return value.trim();
}

/**
 * Récupère une variable d'env optionnelle avec valeur par défaut.
 */
function optional(key, defaultValue = '') {
  return (process.env[key] || defaultValue).toString().trim();
}

/**
 * Récupère un entier depuis les variables d'env.
 */
function integer(key, defaultValue) {
  const raw = process.env[key];
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Récupère un booléen depuis les variables d'env.
 */
function bool(key, defaultValue = false) {
  const raw = optional(key, String(defaultValue));
  return raw === 'true' || raw === '1';
}

// ---------------------------------------------------------------------------
// Validation au démarrage
// ---------------------------------------------------------------------------

const isProd = optional('NODE_ENV') === 'production';

/**
 * Parse d'une URL PostgreSQL.
 * Accepte :
 * - postgresql://user:pass@host:port/db
 * - postgresql://user@host/db (sans pass)
 *
 * @param {string} databaseUrl
 * @returns {{host:string, port:number, name:string, user:string, password:string}}
 */
function parsePostgresUrl(databaseUrl) {
  // URL() exige un schéma valide
  const url = new URL(databaseUrl);

  const host = url.hostname;
  const port = url.port ? parseInt(url.port, 10) : 5432;
  const name = url.pathname ? url.pathname.replace(/^\//, '') : '';

  const user = url.username || '';
  const password = url.password || '';

  return { host, port, name, user, password };
}

// En production, JWT est requis. Pour PostgreSQL, Railway peut fournir tout dans DATABASE_URL.
if (isProd) {
  [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
  ].forEach(required);

  // POSTGRES_PASSWORD peut ne pas exister en prod si Railway ne fournit que DATABASE_URL.
  // Donc on ne l'exige que si DATABASE_URL n'est pas présent.
  if (!process.env.DATABASE_URL && !process.env.DATABASE_PUBLIC_URL) {
    required('POSTGRES_PASSWORD');
  }
}

// ---------------------------------------------------------------------------
// Export de la configuration
// ---------------------------------------------------------------------------

const config = Object.freeze({

  env: optional('NODE_ENV', 'development'),
  isProd,
  isDev:     optional('NODE_ENV', 'development') === 'development',
  isTest:    optional('NODE_ENV') === 'test',

  server: {
    port:       integer('PORT', 3000),
    apiVersion: optional('API_VERSION', 'v1'),
    appName:    optional('APP_NAME', 'LISSAFI-P'),
    baseUrl:    optional('BASE_URL', 'http://localhost:3000'),
  },

  db: {
    // 1) Railway fournit souvent DATABASE_URL (et éventuellement DATABASE_PUBLIC_URL)
    // 2) Sinon, fallback sur les variables PG* / DB_*.

    ...(() => {
      const databaseUrl = optional('DATABASE_URL', '') || optional('DATABASE_PUBLIC_URL', '');

      if (databaseUrl) {
        const parsed = parsePostgresUrl(databaseUrl);

        // DB_SSL : dans Railway, les URLs sont parfois déjà en mode TLS.
        // On force ssl si DB_SSL=true, sinon on l'active quand l'URL n'indique pas clairement un mode non-SSL.
        const urlParams = new URL(databaseUrl);
        const sslFromUrl = (urlParams.searchParams.get('sslmode') || urlParams.searchParams.get('ssl')) !== null;
        const ssl = bool('DB_SSL', sslFromUrl);

        return {
          host: parsed.host,
          port: parsed.port,
          name: parsed.name || optional('DB_NAME', optional('PGDATABASE', 'lissafi_db')),
          user: parsed.user || optional('DB_USER', optional('PGUSER', 'lissafi_user')),
          password: parsed.password || optional('DB_PASSWORD', optional('PGPASSWORD', '')),
          ssl,
        };
      }

      return {
        host: optional('DB_HOST') || optional('PGHOST', 'localhost'),
        port: integer('DB_PORT', 0) || integer('PGPORT', 5432),
        name: optional('DB_NAME') || optional('PGDATABASE', 'lissafi_db'),
        user: optional('DB_USER') || optional('PGUSER', 'lissafi_user'),
        password: optional('DB_PASSWORD') || optional('PGPASSWORD', ''),
        ssl: bool('DB_SSL', false),
      };
    })(),

    pool: {
      min: integer('DB_POOL_MIN', 2),
      max: integer('DB_POOL_MAX', 10),
    },
  },


  redis: {
    host:     optional('REDISHOST', 'localhost'),
    port:     integer('REDISPORT', 6379),
    password: optional('REDISPASSWORD', '') || undefined,
    db:       integer('REDIS_DB', 0),
  },

  jwt: {
    accessSecret:    optional('JWT_ACCESS_SECRET',  'dev_access_secret_change_me_in_prod'),
    refreshSecret:   optional('JWT_REFRESH_SECRET', 'dev_refresh_secret_change_me_in_prod'),
    accessExpiresIn: optional('JWT_ACCESS_EXPIRES_IN',  '15m'),
    refreshExpiresIn:optional('JWT_REFRESH_EXPIRES_IN', '30d'),
  },

  otp: {
    expiresMinutes: integer('OTP_EXPIRES_MINUTES', 10),
    maxAttempts:    integer('OTP_MAX_ATTEMPTS', 5),
  },

  twilio: {
    accountSid:  optional('TWILIO_ACCOUNT_SID', ''),
    authToken:   optional('TWILIO_AUTH_TOKEN', ''),
    phoneNumber: optional('TWILIO_PHONE_NUMBER', ''),
  },

  sms: {
    bypass: bool('SMS_BYPASS', true),
  },

  firebase: {
    projectId:    optional('FIREBASE_PROJECT_ID', ''),
    privateKeyId: optional('FIREBASE_PRIVATE_KEY_ID', ''),
    privateKey:   optional('FIREBASE_PRIVATE_KEY', '').replace(/\\n/g, '\n'),
    clientEmail:  optional('FIREBASE_CLIENT_EMAIL', ''),
  },

  boutique: {
    baseUrl: optional('BOUTIQUE_BASE_URL', 'http://localhost:3000/boutique'),
  },

  security: {
    bcryptRounds:       integer('BCRYPT_ROUNDS', 12),
    rateLimitWindowMs:  integer('RATE_LIMIT_WINDOW_MS', 900000),
    rateLimitMax:       integer('RATE_LIMIT_MAX_REQUESTS', 100),
    rateLimitAuthMax:   integer('RATE_LIMIT_AUTH_MAX', 10),
  },

  logging: {
    level: optional('LOG_LEVEL', 'debug'),
    dir:   optional('LOG_DIR', './logs'),
  },

  // Limites métier plan FREE (contrôle applicatif)
  limits: {
    free: {
      operationsPerMonth: integer('FREE_MAX_OPERATIONS_PER_MONTH', 30),
      products:           integer('FREE_MAX_PRODUCTS', 20),
      clients:            integer('FREE_MAX_CLIENTS', 10),
      smsPerMonth:        integer('FREE_MAX_SMS_PER_MONTH', 0),
    },
    pro: {
      smsPerMonth: integer('PRO_MAX_SMS_PER_MONTH', 20),
    },
  },

});

module.exports = config;
