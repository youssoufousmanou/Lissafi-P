'use strict';

/**
 * Pool de connexions PostgreSQL via node-postgres (pg).
 *
 * Architecture :
 * - Un seul pool partagé dans toute l'application (singleton)
 * - Méthode query() : requête simple
 * - Méthode transaction() : bloc atomique avec rollback automatique
 * - Méthode healthCheck() : utilisé par le /health endpoint
 */

const { Pool } = require('pg');
const config   = require('./env');
const logger   = require('../utils/logger');

// ---------------------------------------------------------------------------
// Création du pool (singleton)
// ---------------------------------------------------------------------------

const poolConfig = {
  host:     config.db.host,
  port:     config.db.port,
  database: config.db.name,
  user:     config.db.user,
  password: config.db.password,
  min:      config.db.pool.min,
  max:      config.db.pool.max,
  idleTimeoutMillis:    30_000,   // libère les connexions inactives après 30s
  connectionTimeoutMillis: 5_000, // lève une erreur si connexion impossible en 5s
  statement_timeout:   30_000,    // annule les requêtes > 30s
};

if (config.db.ssl) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);

// ---------------------------------------------------------------------------
// Événements du pool
// ---------------------------------------------------------------------------

pool.on('connect', () => {
  logger.debug('[DB] Nouvelle connexion établie dans le pool');
});

pool.on('error', (err) => {
  // Une connexion inactive a rencontré une erreur (ex: coupure réseau)
  logger.error('[DB] Erreur inattendue sur une connexion du pool', { error: err.message });
});

// ---------------------------------------------------------------------------
// API publique du module
// ---------------------------------------------------------------------------

/**
 * Exécute une requête SQL simple.
 *
 * @param {string}  sql    - Requête paramétrée (ex: 'SELECT * FROM users WHERE id = $1')
 * @param {Array}   params - Paramètres positionnels (évite les injections SQL)
 * @returns {Promise<import('pg').QueryResult>}
 *
 * @example
 * const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
 */
async function query(sql, params = []) {
  const start = Date.now();
  try {
    const result = await pool.query(sql, params);
    const duration = Date.now() - start;
    logger.debug('[DB] Query exécutée', { duration: `${duration}ms`, rows: result.rowCount });
    return result;
  } catch (err) {
    logger.error('[DB] Erreur de query', { sql, error: err.message });
    throw err;
  }
}

/**
 * Exécute plusieurs opérations dans une transaction atomique.
 * En cas d'erreur, rollback automatique.
 *
 * @param {Function} fn - Fonction async qui reçoit le client de transaction
 * @returns {Promise<*>} - Valeur retournée par fn
 *
 * @example
 * const result = await db.transaction(async (client) => {
 *   await client.query('UPDATE products SET stock_qty = stock_qty - $1 WHERE id = $2', [qty, id]);
 *   await client.query('INSERT INTO stock_movements ...', [...]);
 *   return { success: true };
 * });
 */
async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('[DB] Transaction rollback', { error: err.message });
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Vérifie que la connexion à la base est fonctionnelle.
 * Utilisé par le endpoint GET /health.
 *
 * @returns {Promise<{status: string, latencyMs: number}>}
 */
async function healthCheck() {
  const start = Date.now();
  await pool.query('SELECT 1');
  return { status: 'ok', latencyMs: Date.now() - start };
}

/**
 * Ferme proprement le pool (pour les tests et l'arrêt gracieux).
 */
async function close() {
  await pool.end();
  logger.info('[DB] Pool fermé');
}

module.exports = { query, transaction, healthCheck, close, pool };
