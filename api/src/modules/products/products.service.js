'use strict';

/**
 * Service Products — Module M3 LISSAFI-P
 *
 * Logique métier du catalogue produits :
 * création, lecture, mise à jour, suppression logique.
 *
 * Règles métier (CDC §2.4) :
 * - Plan FREE : 20 produits actifs maximum (limite contrôlée en DB + cache Redis)
 * - Soft delete : is_active = false (les produits liés aux opérations restent accessibles)
 * - Ownership strict : un utilisateur ne voit que ses propres produits
 * - Taux de marge calculé à la volée si les deux prix sont renseignés
 *
 * Ce service ne touche jamais req/res.
 */

const db     = require('../../config/db');
const cache  = require('../../config/redis');
const config = require('../../config/env');
const logger = require('../../utils/logger');

// ---------------------------------------------------------------------------
// Constante
// ---------------------------------------------------------------------------

/** Limite du nombre de produits actifs pour le plan FREE */
const FREE_PRODUCTS_LIMIT = config.limits.free.products; // 20

/** TTL du cache pour le compteur de produits (secondes) */
const PRODUCTS_COUNT_CACHE_TTL = 300; // 5 minutes

// ---------------------------------------------------------------------------
// Helper privé — compteur Redis
// ---------------------------------------------------------------------------

/**
 * Retourne le nombre de produits actifs de l'utilisateur.
 * Utilise un cache Redis pour éviter un COUNT(*) à chaque création.
 *
 * @param {string} userId
 * @returns {Promise<number>}
 */
async function _getActiveProductsCount(userId) {
  const cacheKey = cache.KEYS.productsCount(userId);

  // Tentative depuis le cache
  const cached = await cache.get(cacheKey);
  if (cached !== null) return Number(cached);

  // Fallback DB
  const { rows } = await db.query(
    'SELECT COUNT(*)::int AS count FROM products WHERE user_id = $1 AND is_active = TRUE',
    [userId]
  );
  const count = rows[0].count;

  // Mettre en cache
  await cache.set(cacheKey, count, PRODUCTS_COUNT_CACHE_TTL);
  return count;
}

/**
 * Invalide le cache du compteur de produits.
 * Appelé après chaque création ou suppression.
 *
 * @param {string} userId
 */
async function _invalidateProductsCount(userId) {
  await cache.del(cache.KEYS.productsCount(userId));
}

// ---------------------------------------------------------------------------
// 1. VÉRIFICATION DE LA LIMITE (plan FREE)
// ---------------------------------------------------------------------------

/**
 * Vérifie si l'utilisateur FREE a atteint sa limite de produits actifs.
 *
 * @param {string} userId
 * @param {string} plan   - 'FREE' | 'PRO'
 * @returns {Promise<{ count: number, limit: number, canCreate: boolean }>}
 */
async function checkProductsLimit(userId, plan) {
  if (plan === 'PRO') {
    return { count: 0, limit: Infinity, canCreate: true };
  }

  const count = await _getActiveProductsCount(userId);

  return {
    count,
    limit:     FREE_PRODUCTS_LIMIT,
    canCreate: count < FREE_PRODUCTS_LIMIT,
  };
}

// ---------------------------------------------------------------------------
// 2. CRÉER UN PRODUIT
// ---------------------------------------------------------------------------

/**
 * Crée un nouveau produit dans le catalogue.
 *
 * @param {string} userId
 * @param {string} plan      - 'FREE' | 'PRO'
 * @param {Object} data      - Données validées par createProductSchema
 * @returns {Promise<Object>} Produit créé avec taux de marge calculé
 * @throws {Error} 429 si limite FREE atteinte
 */
async function createProduct(userId, plan, data) {
  // — Vérification de la limite FREE
  const limitCheck = await checkProductsLimit(userId, plan);
  if (!limitCheck.canCreate) {
    const err = new Error(
      `Limite atteinte (${FREE_PRODUCTS_LIMIT} produits max en plan Gratuit). ` +
      'Passez au plan Pro pour un catalogue illimité.'
    );
    err.statusCode = 429;
    throw err;
  }

  const { rows } = await db.query(
    `INSERT INTO products
       (user_id, name, description, unit,
        purchase_price, sale_price, stock_qty, alert_threshold)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING
       id, user_id, name, description, unit,
       purchase_price, sale_price, stock_qty,
       alert_threshold, is_active, created_at, updated_at`,
    [
      userId,
      data.name,
      data.description   || null,
      data.unit          || 'PCS',
      data.purchase_price != null ? data.purchase_price : null,
      data.sale_price     != null ? data.sale_price     : null,
      data.stock_qty      ?? 0,
      data.alert_threshold ?? 5,
    ]
  );

  const product = _enrichProduct(rows[0]);

  // Invalider le cache du compteur
  await _invalidateProductsCount(userId);

  logger.info('[Products] Produit créé', {
    userId,
    productId: product.id,
    name:      product.name,
  });

  return product;
}

// ---------------------------------------------------------------------------
// 3. LISTE DES PRODUITS (paginée, filtrée)
// ---------------------------------------------------------------------------

/**
 * Retourne la liste paginée des produits actifs de l'utilisateur.
 *
 * @param {string} userId
 * @param {Object} filters - Filtres validés par listProductsSchema
 * @returns {Promise<{ items: Object[], total: number, page: number, limit: number }>}
 */
async function getProducts(userId, filters) {
  const { page, limit, sort_by, sort_dir, search, low_stock_only } = filters;
  const offset = (page - 1) * limit;

  // Whitelist pour éviter l'injection SQL dans ORDER BY
  const ALLOWED_SORT = {
    name:       'p.name',
    stock_qty:  'p.stock_qty',
    sale_price: 'p.sale_price',
    created_at: 'p.created_at',
  };
  const sortColumn = ALLOWED_SORT[sort_by] || 'p.name';
  const sortDir    = sort_dir === 'DESC' ? 'DESC' : 'ASC';

  // Construire les conditions WHERE dynamiquement
  const conditions = ['p.user_id = $1', 'p.is_active = TRUE'];
  const params     = [userId];
  let   idx        = 2;

  if (search) {
    conditions.push(`p.name ILIKE $${idx++}`);
    params.push(`%${search}%`);
  }

  if (low_stock_only) {
    // Produits dont le stock est <= seuil d'alerte
    conditions.push(`p.stock_qty <= p.alert_threshold`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  // Requête COUNT
  const countResult = await db.query(
    `SELECT COUNT(*)::int AS total FROM products p ${whereClause}`,
    params
  );
  const total = countResult.rows[0].total;

  // Requête principale
  const dataResult = await db.query(
    `SELECT
       p.id,
       p.name,
       p.description,
       p.unit,
       p.purchase_price,
       p.sale_price,
       p.stock_qty,
       p.alert_threshold,
       p.is_active,
       p.created_at,
       p.updated_at
     FROM products p
     ${whereClause}
     ORDER BY ${sortColumn} ${sortDir}
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return {
    items: dataResult.rows.map(_enrichProduct),
    total,
    page,
    limit,
  };
}

// ---------------------------------------------------------------------------
// 4. DÉTAIL D'UN PRODUIT
// ---------------------------------------------------------------------------

/**
 * Retourne le détail d'un produit spécifique.
 * Vérifie l'ownership.
 *
 * @param {string} userId
 * @param {string} productId - UUID
 * @param {boolean} [includeInactive=false] — inclure les produits désactivés
 * @returns {Promise<Object>}
 * @throws {Error} 404 si introuvable ou ne fait pas partie du catalogue de l'utilisateur
 */
async function getProductById(userId, productId, includeInactive = false) {
  const activeClause = includeInactive ? '' : 'AND p.is_active = TRUE';

  const { rows } = await db.query(
    `SELECT
       p.id, p.name, p.description, p.unit,
       p.purchase_price, p.sale_price, p.stock_qty,
       p.alert_threshold, p.is_active,
       p.created_at, p.updated_at
     FROM products p
     WHERE p.id = $1 AND p.user_id = $2 ${activeClause}`,
    [productId, userId]
  );

  if (rows.length === 0) {
    const err = new Error('Produit introuvable');
    err.statusCode = 404;
    throw err;
  }

  return _enrichProduct(rows[0]);
}

// ---------------------------------------------------------------------------
// 5. MODIFIER UN PRODUIT
// ---------------------------------------------------------------------------

/**
 * Met à jour les informations d'un produit existant.
 * Note : stock_qty n'est PAS modifiable ici — passer par le module Stock.
 *
 * @param {string} userId
 * @param {string} productId
 * @param {Object} data - Données validées par updateProductSchema
 * @returns {Promise<Object>} Produit mis à jour
 * @throws {Error} 404 si introuvable
 */
async function updateProduct(userId, productId, data) {
  // Vérifier existence + ownership
  await getProductById(userId, productId);

  const allowedFields = [
    'name', 'description', 'unit',
    'purchase_price', 'sale_price',
    'alert_threshold',
  ];

  const setClauses = [];
  const params     = [];
  let   idx        = 1;

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      setClauses.push(`${field} = $${idx++}`);
      // Permettre de mettre null pour effacer un prix
      params.push(data[field] === '' ? null : data[field]);
    }
  }

  if (setClauses.length === 0) {
    const err = new Error('Aucun champ valide à mettre à jour');
    err.statusCode = 400;
    throw err;
  }

  params.push(productId, userId);

  const { rows } = await db.query(
    `UPDATE products
     SET ${setClauses.join(', ')}, updated_at = NOW()
     WHERE id = $${idx} AND user_id = $${idx + 1}
     RETURNING
       id, name, description, unit, purchase_price, sale_price,
       stock_qty, alert_threshold, is_active, created_at, updated_at`,
    params
  );

  logger.info('[Products] Produit mis à jour', { userId, productId });
  return _enrichProduct(rows[0]);
}

// ---------------------------------------------------------------------------
// 6. SUPPRIMER UN PRODUIT (soft delete)
// ---------------------------------------------------------------------------

/**
 * Désactive un produit (soft delete : is_active = false).
 * Le produit reste en base pour préserver l'historique des opérations.
 *
 * @param {string} userId
 * @param {string} productId
 * @returns {Promise<void>}
 * @throws {Error} 404 si introuvable
 */
async function deleteProduct(userId, productId) {
  // Vérifier existence + ownership
  await getProductById(userId, productId);

  await db.query(
    'UPDATE products SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND user_id = $2',
    [productId, userId]
  );

  // Invalider le cache du compteur (le produit n'est plus actif)
  await _invalidateProductsCount(userId);

  logger.info('[Products] Produit désactivé', { userId, productId });
}

// ---------------------------------------------------------------------------
// Helper privé — enrichissement d'un produit
// ---------------------------------------------------------------------------

/**
 * Ajoute les champs calculés à un produit retourné par la DB :
 * - `margin_rate` : taux de marge brute en % (si les deux prix sont renseignés)
 * - `stock_value` : valeur totale du stock au prix d'achat
 * - `is_low_stock` : vrai si stock_qty <= alert_threshold
 *
 * @param {Object} row - Ligne retournée par pg
 * @returns {Object}
 */
function _enrichProduct(row) {
  const p = { ...row };

  // Taux de marge : (prix_vente - prix_achat) / prix_vente * 100
  if (p.sale_price > 0 && p.purchase_price != null) {
    p.margin_rate = Number(
      (((p.sale_price - p.purchase_price) / p.sale_price) * 100).toFixed(1)
    );
  } else {
    p.margin_rate = null;
  }

  // Valeur du stock au prix d'achat
  p.stock_value = p.purchase_price != null
    ? p.stock_qty * p.purchase_price
    : null;

  // Indicateur de rupture
  p.is_low_stock = p.stock_qty <= p.alert_threshold;

  return p;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  FREE_PRODUCTS_LIMIT,
  checkProductsLimit,
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
};
