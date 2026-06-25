'use strict';

/**
 * Service Stock — Module M3 LISSAFI-P
 *
 * Gère tous les mouvements de stock et les alertes de rupture.
 *
 * Règles métier (CDC §2.4.2) :
 * - Chaque mouvement est tracé dans stock_movements avec quantité avant/après
 * - Les mouvements ENTREE / SORTIE / AJUSTEMENT utilisent des transactions
 *   atomiques (UPDATE produit + INSERT mouvement en même temps)
 * - Le stock ne peut jamais descendre en dessous de 0 (SORTIE bloquée)
 * - Une alerte est déclenchée quand stock_qty <= alert_threshold
 * - Les alertes sont cachées dans Redis pour éviter de spammer Firebase
 *
 * Ce service ne touche jamais req/res.
 */

const db     = require('../../config/db');
const cache  = require('../../config/redis');
const logger = require('../../utils/logger');

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** TTL du cache d'alertes stock (5 min) */
const STOCK_ALERTS_CACHE_TTL = 300;

/** TTL du cache de valorisation totale (5 min) */
const STOCK_VALUATION_CACHE_TTL = 300;

const VALUATION_CACHE_KEY = (userId) => `cache:stock:valuation:${userId}`;
const DB_MOVEMENT_TYPES = {
  ENTREE: 'IN',
  SORTIE: 'OUT',
  AJUSTEMENT: 'ADJUSTMENT',
};

const APP_MOVEMENT_TYPES = {
  IN: 'ENTREE',
  OUT: 'SORTIE',
  ADJUSTMENT: 'AJUSTEMENT',
};

// ---------------------------------------------------------------------------
// Helpers privés
// ---------------------------------------------------------------------------

/**
 * Invalide les caches dépendants d'un produit après un mouvement de stock.
 *
 * @param {string} userId
 */
async function _invalidateStockCaches(userId) {
  await cache.del(
    cache.KEYS.stockAlerts(userId),
    VALUATION_CACHE_KEY(userId),
    cache.KEYS.dashboardCache(userId)
  );
}

// ---------------------------------------------------------------------------
// 1. CRÉER UN MOUVEMENT DE STOCK (point d'entrée principal)
// ---------------------------------------------------------------------------

/**
 * Enregistre un mouvement de stock et met à jour le stock du produit.
 * Dispatcher vers addStock / removeStock / adjustStock selon le type.
 *
 * @param {string} userId
 * @param {Object} data   - Données validées par createMovementSchema
 * @returns {Promise<Object>} Le mouvement créé avec les nouvelles quantités
 * @throws {Error} 400 si stock insuffisant (SORTIE)
 * @throws {Error} 400 si quantité invalide pour le type
 */
async function createMovement(userId, data) {
  const { product_id, movement_type, quantity, reason } = data;

  switch (movement_type) {
    case 'ENTREE':
      return addStock(userId, { product_id, quantity, reason });
    case 'SORTIE':
      return removeStock(userId, { product_id, quantity, reason });
    case 'AJUSTEMENT':
      return adjustStock(userId, { product_id, quantity, reason });
    default: {
      const err = new Error('Type de mouvement inconnu');
      err.statusCode = 400;
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// 2. ENTRÉE DE STOCK
// ---------------------------------------------------------------------------

/**
 * Enregistre une entrée de stock (réception de marchandises).
 * Augmente stock_qty du produit du montant indiqué.
 *
 * @param {string} userId
 * @param {Object} data   - { product_id, quantity (≥1), reason? }
 * @returns {Promise<Object>} Mouvement créé
 */
async function addStock(userId, data) {
  const { product_id, quantity, reason } = data;

  if (quantity < 1) {
    const err = new Error('La quantité d\'une entrée de stock doit être d\'au moins 1');
    err.statusCode = 400;
    throw err;
  }

  const movement = await db.transaction(async (client) => {
    // Verrouiller le produit pour la transaction (SELECT FOR UPDATE)
    const { rows: productRows } = await client.query(
      `SELECT id, stock_qty, alert_threshold
       FROM products
       WHERE id = $1 AND user_id = $2 AND is_active = TRUE
       FOR UPDATE`,
      [product_id, userId]
    );

    if (productRows.length === 0) {
      const err = new Error('Produit introuvable ou ne vous appartient pas');
      err.statusCode = 404;
      throw err;
    }

    const product        = productRows[0];
    const quantityBefore = product.stock_qty;
    const quantityAfter  = quantityBefore + quantity;

    // Mettre à jour le stock du produit
    await client.query(
      'UPDATE products SET stock_qty = $1, updated_at = NOW() WHERE id = $2',
      [quantityAfter, product_id]
    );

    // Enregistrer le mouvement
    const { rows: movementRows } = await client.query(
      `INSERT INTO stock_movements
         (product_id, user_id, movement_type, quantity,
          stock_after, reason)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [product_id, userId, DB_MOVEMENT_TYPES.ENTREE, quantity, quantityAfter, reason || null]
    );

    return { ...movementRows[0], threshold: product.alert_threshold };
  });

  await _invalidateStockCaches(userId);
  await _checkAndNotifyAlert(userId, product_id, movement.stock_after, movement.threshold);

  logger.info('[Stock] Entrée enregistrée', {
    userId, product_id,
    quantity, after: movement.stock_after,
  });

  return _formatMovement(movement);
}

// ---------------------------------------------------------------------------
// 3. SORTIE DE STOCK
// ---------------------------------------------------------------------------

/**
 * Enregistre une sortie de stock (vente, consommation, perte).
 * Vérifie que le stock est suffisant avant de décrémenter.
 *
 * @param {string} userId
 * @param {Object} data   - { product_id, quantity (≥1), reason? }
 * @returns {Promise<Object>} Mouvement créé
 * @throws {Error} 400 si stock insuffisant
 */
async function removeStock(userId, data) {
  const { product_id, quantity, reason } = data;

  if (quantity < 1) {
    const err = new Error('La quantité d\'une sortie de stock doit être d\'au moins 1');
    err.statusCode = 400;
    throw err;
  }

  const movement = await db.transaction(async (client) => {
    const { rows: productRows } = await client.query(
      `SELECT id, stock_qty, alert_threshold
       FROM products
       WHERE id = $1 AND user_id = $2 AND is_active = TRUE
       FOR UPDATE`,
      [product_id, userId]
    );

    if (productRows.length === 0) {
      const err = new Error('Produit introuvable ou ne vous appartient pas');
      err.statusCode = 404;
      throw err;
    }

    const product        = productRows[0];
    const quantityBefore = product.stock_qty;

    // Vérifier stock suffisant
    if (quantityBefore < quantity) {
      const err = new Error(
        `Stock insuffisant. Disponible : ${quantityBefore}, demandé : ${quantity}.`
      );
      err.statusCode = 400;
      throw err;
    }

    const quantityAfter = quantityBefore - quantity;

    await client.query(
      'UPDATE products SET stock_qty = $1, updated_at = NOW() WHERE id = $2',
      [quantityAfter, product_id]
    );

    const { rows: movementRows } = await client.query(
      `INSERT INTO stock_movements
         (product_id, user_id, movement_type, quantity,
          stock_after, reason)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [product_id, userId, DB_MOVEMENT_TYPES.SORTIE, quantity, quantityAfter, reason || null]
    );

    return { ...movementRows[0], threshold: product.alert_threshold };
  });

  await _invalidateStockCaches(userId);
  await _checkAndNotifyAlert(userId, product_id, movement.stock_after, movement.threshold);

  logger.info('[Stock] Sortie enregistrée', {
    userId, product_id,
    quantity, after: movement.stock_after,
  });

  return _formatMovement(movement);
}

// ---------------------------------------------------------------------------
// 4. AJUSTEMENT DE STOCK (inventaire manuel)
// ---------------------------------------------------------------------------

/**
 * Corrige manuellement le stock d'un produit (inventaire physique).
 * La quantity représente le NOUVEAU TOTAL, pas un delta.
 *
 * @param {string} userId
 * @param {Object} data   - { product_id, quantity (nouveau total ≥0), reason? }
 * @returns {Promise<Object>} Mouvement créé
 */
async function adjustStock(userId, data) {
  const { product_id, quantity, reason } = data;

  const movement = await db.transaction(async (client) => {
    const { rows: productRows } = await client.query(
      `SELECT id, stock_qty, alert_threshold
       FROM products
       WHERE id = $1 AND user_id = $2 AND is_active = TRUE
       FOR UPDATE`,
      [product_id, userId]
    );

    if (productRows.length === 0) {
      const err = new Error('Produit introuvable ou ne vous appartient pas');
      err.statusCode = 404;
      throw err;
    }

    const product        = productRows[0];
    const quantityBefore = product.stock_qty;
    const quantityAfter  = quantity; // nouvelle valeur absolue

    await client.query(
      'UPDATE products SET stock_qty = $1, updated_at = NOW() WHERE id = $2',
      [quantityAfter, product_id]
    );

    const delta = quantityAfter - quantityBefore;
    const { rows: movementRows } = await client.query(
      `INSERT INTO stock_movements
         (product_id, user_id, movement_type, quantity,
          stock_after, reason)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [product_id, userId, DB_MOVEMENT_TYPES.AJUSTEMENT, Math.abs(delta), quantityAfter, reason || null]
    );

    return { ...movementRows[0], threshold: product.alert_threshold };
  });

  await _invalidateStockCaches(userId);
  await _checkAndNotifyAlert(userId, product_id, movement.stock_after, movement.threshold);

  logger.info('[Stock] Ajustement enregistré', {
    userId, product_id,
    newQty: movement.stock_after,
  });

  return _formatMovement(movement);
}

// ---------------------------------------------------------------------------
// 5. HISTORIQUE DES MOUVEMENTS D'UN PRODUIT
// ---------------------------------------------------------------------------

/**
 * Retourne l'historique paginé des mouvements de stock d'un produit.
 *
 * @param {string} userId
 * @param {string} productId
 * @param {Object} filters   - { movement_type?, page, limit }
 * @returns {Promise<{ items: Object[], total: number, page: number, limit: number }>}
 * @throws {Error} 404 si le produit n'appartient pas à l'utilisateur
 */
async function getMovements(userId, productId, filters) {
  // Vérifier ownership du produit (inclure désactivés pour l'historique)
  const productCheck = await db.query(
    'SELECT id FROM products WHERE id = $1 AND user_id = $2',
    [productId, userId]
  );
  if (productCheck.rowCount === 0) {
    const err = new Error('Produit introuvable');
    err.statusCode = 404;
    throw err;
  }

  const { page, limit, movement_type } = filters;
  const offset = (page - 1) * limit;

  const conditions = ['sm.product_id = $1'];
  const params     = [productId];
  let   idx        = 2;

  if (movement_type) {
    conditions.push(`sm.movement_type = $${idx++}`);
    params.push(DB_MOVEMENT_TYPES[movement_type]);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countResult = await db.query(
    `SELECT COUNT(*)::int AS total FROM stock_movements sm ${whereClause}`,
    params
  );

  const dataResult = await db.query(
    `SELECT
       sm.id,
       sm.movement_type,
       sm.quantity,
       sm.stock_after,
       sm.reason,
       sm.created_at,
       p.name AS product_name,
       p.unit AS product_unit
     FROM stock_movements sm
     JOIN products p ON p.id = sm.product_id
     ${whereClause}
     ORDER BY sm.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return {
    items: dataResult.rows.map(_formatMovement),
    total: countResult.rows[0].total,
    page,
    limit,
  };
}

// ---------------------------------------------------------------------------
// 6. ALERTES DE STOCK (produits sous le seuil)
// ---------------------------------------------------------------------------

/**
 * Retourne la liste des produits dont le stock est inférieur ou égal
 * au seuil d'alerte configuré.
 * Résultat mis en cache 5 minutes.
 *
 * @param {string} userId
 * @returns {Promise<Object[]>} Liste des produits en alerte
 */
async function getAlerts(userId) {
  const cacheKey = cache.KEYS.stockAlerts(userId);

  // Tentative depuis le cache
  const cached = await cache.get(cacheKey);
  if (cached !== null) return cached;

  const { rows } = await db.query(
    `SELECT
       id,
       name,
       unit,
       stock_qty,
       alert_threshold,
       sale_price,
       (stock_qty - alert_threshold) AS stock_deficit
     FROM products
     WHERE user_id = $1
       AND is_active = TRUE
       AND stock_qty <= alert_threshold
     ORDER BY stock_qty ASC, name ASC`,
    [userId]
  );

  await cache.set(cacheKey, rows, STOCK_ALERTS_CACHE_TTL);
  return rows;
}

// ---------------------------------------------------------------------------
// 7. VALORISATION TOTALE DU STOCK
// ---------------------------------------------------------------------------

/**
 * Calcule la valorisation totale du stock au prix d'achat et de vente.
 * Résultat mis en cache 5 minutes.
 *
 * @param {string} userId
 * @returns {Promise<Object>} Résumé de valorisation
 */
async function getValuation(userId) {
  const cacheKey = VALUATION_CACHE_KEY(userId);

  const cached = await cache.get(cacheKey);
  if (cached !== null) return cached;

  // Synthèse globale
  const { rows: totals } = await db.query(
    `SELECT
       COUNT(*)::int                                            AS product_count,
       COALESCE(SUM(stock_qty), 0)::bigint                    AS total_units,
       COALESCE(SUM(
         CASE WHEN purchase_price IS NOT NULL
              THEN stock_qty * purchase_price ELSE 0 END
       ), 0)::bigint                                           AS total_purchase_value,
       COALESCE(SUM(
         CASE WHEN sale_price IS NOT NULL
              THEN stock_qty * sale_price ELSE 0 END
       ), 0)::bigint                                           AS total_sale_value,
       COUNT(CASE WHEN stock_qty <= alert_threshold THEN 1 END)::int AS alert_count
     FROM products
     WHERE user_id = $1 AND is_active = TRUE`,
    [userId]
  );

  // Détail par produit (top 10 les plus valorisés)
  const { rows: topProducts } = await db.query(
    `SELECT
       id,
       name,
       unit,
       stock_qty,
       purchase_price,
       sale_price,
       (CASE WHEN purchase_price IS NOT NULL
             THEN stock_qty * purchase_price ELSE NULL END) AS purchase_value,
       (CASE WHEN sale_price IS NOT NULL
             THEN stock_qty * sale_price ELSE NULL END)    AS sale_value
     FROM products
     WHERE user_id = $1 AND is_active = TRUE
     ORDER BY
       (CASE WHEN purchase_price IS NOT NULL
             THEN stock_qty * purchase_price ELSE 0 END) DESC
     LIMIT 10`,
    [userId]
  );

  const result = {
    ...totals[0],
    top_products: topProducts,
    computed_at:  new Date().toISOString(),
  };

  await cache.set(cacheKey, result, STOCK_VALUATION_CACHE_TTL);
  return result;
}

// ---------------------------------------------------------------------------
// 8. NOTIFICATION D'ALERTE (FCM push)
// ---------------------------------------------------------------------------

/**
 * Envoie une notification push si le stock d'un produit passe sous le seuil.
 * Throttlé par Redis pour éviter le spam (1 alerte / produit / heure).
 *
 * @param {string} userId
 * @param {string} productId
 * @param {number} currentQty
 * @param {number} threshold
 * @returns {Promise<void>}
 */
async function _checkAndNotifyAlert(userId, productId, currentQty, threshold) {
  if (currentQty > threshold) return;

  // Throttling : ne pas renvoyer la même alerte dans l'heure
  const throttleKey = `alert:throttle:stock:${userId}:${productId}`;
  const alreadySent = await cache.get(throttleKey);
  if (alreadySent) return;

  // Marquer l'alerte comme envoyée pendant 1h
  await cache.set(throttleKey, true, 3600);

  // Invalider le cache d'alertes
  await cache.del(cache.KEYS.stockAlerts(userId));

  logger.warn('[Stock] Alerte rupture — produit sous le seuil', {
    userId, productId, currentQty, threshold,
  });

  // TODO : Envoyer notification FCM quand Firebase est intégré (Étape 10)
  // await sendStockAlertNotification(userId, productId, currentQty);
}

// ---------------------------------------------------------------------------
// Helper — formatage d'un mouvement retourné au client
// ---------------------------------------------------------------------------

function _formatMovement(movement) {
  // Retirer le champ interne 'threshold' avant d'exposer au client
  const { threshold, ...formatted } = movement;
  if (formatted.movement_type && APP_MOVEMENT_TYPES[formatted.movement_type]) {
    formatted.movement_type = APP_MOVEMENT_TYPES[formatted.movement_type];
  }
  return formatted;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  createMovement,
  addStock,
  removeStock,
  adjustStock,
  getMovements,
  getAlerts,
  getValuation,
};
