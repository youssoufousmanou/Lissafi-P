'use strict';

/**
 * Client Redis singleton via ioredis.
 *
 * Usages dans LISSAFI-P :
 * - Cache des requêtes fréquentes (dashboard, rapports)
 * - Blacklist des refresh tokens révoqués
 * - Rate limiting distribué (express-rate-limit store)
 * - Compteurs de limites plan FREE (ops/mois, SMS/mois)
 */

const Redis  = require('ioredis');
const config = require('./env');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// Création du client (singleton)
// ---------------------------------------------------------------------------

const redis = new Redis({
  host:               config.redis.host,
  port:               config.redis.port,
  password:           config.redis.password,
  db:                 config.redis.db,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 5) {
      logger.warn('[Redis] Impossible de se reconnecter après 5 tentatives');
      return null; // stoppe les retries
    }
    return Math.min(times * 200, 2000); // backoff exponentiel, max 2s
  },
  lazyConnect: true, // connexion différée (pas au require)
});

// ---------------------------------------------------------------------------
// Événements
// ---------------------------------------------------------------------------

redis.on('connect',  ()    => logger.info('[Redis] Connecté'));
redis.on('error',    (err) => logger.error('[Redis] Erreur', { error: err.message }));
redis.on('close',    ()    => logger.warn('[Redis] Connexion fermée'));

// ---------------------------------------------------------------------------
// Helpers métier
// ---------------------------------------------------------------------------

/**
 * Stocke une valeur avec TTL (Time To Live).
 *
 * @param {string} key
 * @param {*}      value   - Sérialisé en JSON automatiquement
 * @param {number} ttlSec  - Expiration en secondes
 */
async function set(key, value, ttlSec) {
  const serialized = JSON.stringify(value);
  if (ttlSec) {
    await redis.set(key, serialized, 'EX', ttlSec);
  } else {
    await redis.set(key, serialized);
  }
}

/**
 * Récupère et désérialise une valeur.
 *
 * @param {string} key
 * @returns {Promise<*|null>}
 */
async function get(key) {
  const raw = await redis.get(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw; // retourne la chaîne brute si pas du JSON
  }
}

/**
 * Supprime une ou plusieurs clés.
 */
async function del(...keys) {
  if (keys.length > 0) await redis.del(...keys);
}

/**
 * Incrémente un compteur et applique un TTL si c'est le premier incrément.
 * Utilisé pour les limites mensuelles du plan FREE.
 *
 * @param {string} key
 * @param {number} ttlSec
 * @returns {Promise<number>} Nouvelle valeur du compteur
 */
async function incr(key, ttlSec) {
  const value = await redis.incr(key);
  if (value === 1 && ttlSec) {
    await redis.expire(key, ttlSec);
  }
  return value;
}

/**
 * Vérifie la connexion Redis.
 * @returns {Promise<{status: string}>}
 */
async function healthCheck() {
  const pong = await redis.ping();
  return { status: pong === 'PONG' ? 'ok' : 'degraded' };
}

/**
 * Ferme proprement la connexion (tests, arrêt gracieux).
 */
async function close() {
  await redis.quit();
  logger.info('[Redis] Connexion fermée proprement');
}

// ---------------------------------------------------------------------------
// Préfixes de clés Redis (convention : module:entity:id:field)
// ---------------------------------------------------------------------------
const KEYS = {
  // OTP
  otpAttempts: (identifier) => `otp:attempts:${identifier}`,
  pendingRegistration: (identifier) => `auth:pending-registration:${identifier}`,

  // Token blacklist (refresh tokens révoqués)
  tokenBlacklist: (hash) => `token:blacklist:${hash}`,

  // Limites plan FREE (reset mensuel automatique)
  monthlyOps:    (userId, yearMonth) => `limits:ops:${userId}:${yearMonth}`,
  monthlySms:    (userId, yearMonth) => `limits:sms:${userId}:${yearMonth}`,

  // Cache dashboard
  dashboardCache: (userId)           => `cache:dashboard:${userId}`,

  // Cache boutique publique
  boutiqueCache:  (slug)             => `cache:boutique:${slug}`,

  // Cache compteur de produits actifs (plan FREE — limite 20)
  productsCount:  (userId)           => `cache:products:count:${userId}`,

  // Cache alertes de rupture de stock
  stockAlerts:    (userId)           => `cache:stock:alerts:${userId}`,
};

module.exports = { redis, set, get, del, incr, healthCheck, close, KEYS };
