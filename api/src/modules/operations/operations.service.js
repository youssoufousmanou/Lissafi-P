'use strict';

/**
 * Service Operations — Module M2 LISSAFI-P
 *
 * Toute la logique métier des opérations commerciales :
 * ventes, achats, dépenses, recettes.
 *
 * Règles métier (CDC §2.3.2) :
 * - Plan FREE : 30 opérations par mois maximum (compteur Redis)
 * - Tout montant en FCFA (entier positif)
 * - La date peut être rétroactive (saisie différée autorisée)
 * - Vérification d'ownership : un utilisateur ne peut modifier que SES opérations
 *
 * Ce service ne touche jamais req/res — il ne connaît pas Express.
 */

const { format, startOfDay, endOfDay, startOfMonth, endOfMonth } = require('date-fns');

const db     = require('../../config/db');
const cache  = require('../../config/redis');
const logger = require('../../utils/logger');

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Limite mensuelle d'opérations pour le plan FREE */
const FREE_MONTHLY_OPS_LIMIT = 30;

/** TTL pour invalider le cache dashboard après une modification (secondes) */
const DASHBOARD_CACHE_TTL_SEC = 300; // 5 minutes

// ---------------------------------------------------------------------------
// Helpers privés
// ---------------------------------------------------------------------------

/**
 * Formate une clé Redis pour le compteur mensuel d'opérations.
 * Ex: "limits:ops:uuid:2026-05"
 *
 * @param {string} userId
 * @param {Date}   [date] - Défaut : maintenant
 * @returns {string}
 */
function _monthlyOpsKey(userId, date = new Date()) {
  const yearMonth = format(date, 'yyyy-MM');
  return cache.KEYS.monthlyOps(userId, yearMonth);
}

/**
 * Calcule le TTL en secondes jusqu'à la fin du mois courant.
 * Utilisé pour l'expiration automatique du compteur Redis.
 *
 * @returns {number} secondes
 */
function _secondsUntilEndOfMonth() {
  const now = new Date();
  const end = endOfMonth(now);
  return Math.ceil((end.getTime() - now.getTime()) / 1000) + 1;
}

/**
 * Construit la clause WHERE SQL et le tableau de paramètres
 * à partir des filtres validés par le validator.
 *
 * @param {string} userId
 * @param {Object} filters
 * @returns {{ clause: string, params: any[], nextIdx: number }}
 */
function _buildWhereClause(userId, filters) {
  const conditions = ['o.user_id = $1'];
  const params     = [userId];
  let   idx        = 2;

  if (filters.type) {
    conditions.push(`o.type = $${idx++}`);
    params.push(filters.type);
  }

  if (filters.date_from) {
    conditions.push(`o.op_date >= $${idx++}`);
    params.push(startOfDay(new Date(filters.date_from)));
  }

  if (filters.date_to) {
    conditions.push(`o.op_date <= $${idx++}`);
    params.push(endOfDay(new Date(filters.date_to)));
  }

  if (filters.amount_min !== undefined) {
    conditions.push(`o.amount >= $${idx++}`);
    params.push(filters.amount_min);
  }

  if (filters.amount_max !== undefined) {
    conditions.push(`o.amount <= $${idx++}`);
    params.push(filters.amount_max);
  }

  if (filters.search) {
    conditions.push(`(o.article_name ILIKE $${idx} OR o.supplier_name ILIKE $${idx})`);
    params.push(`%${filters.search}%`);
    idx++;
  }

  return {
    clause:  `WHERE ${conditions.join(' AND ')}`,
    params,
    nextIdx: idx,
  };
}

// ---------------------------------------------------------------------------
// 1. VÉRIFICATION DE LA LIMITE MENSUELLE (plan FREE)
// ---------------------------------------------------------------------------

/**
 * Vérifie si l'utilisateur FREE a atteint sa limite mensuelle d'opérations.
 * Utilise Redis comme compteur rapide (évite un COUNT(*) SQL à chaque création).
 *
 * @param {string} userId
 * @param {string} plan   - 'FREE' | 'PRO'
 * @returns {Promise<{ count: number, limit: number, canCreate: boolean }>}
 */
async function checkMonthlyLimit(userId, plan) {
  // Les utilisateurs PRO n'ont pas de limite
  if (plan === 'PRO') {
    return { count: 0, limit: Infinity, canCreate: true };
  }

  const key   = _monthlyOpsKey(userId);
  const raw   = await cache.get(key);
  const count = raw ? parseInt(raw, 10) : 0;

  return {
    count,
    limit:     FREE_MONTHLY_OPS_LIMIT,
    canCreate: count < FREE_MONTHLY_OPS_LIMIT,
  };
}

// ---------------------------------------------------------------------------
// 2. CRÉER UNE OPÉRATION
// ---------------------------------------------------------------------------

/**
 * Enregistre une nouvelle opération commerciale.
 *
 * @param {string} userId
 * @param {string} plan      - 'FREE' | 'PRO'
 * @param {Object} data      - Données validées par createOperationSchema
 * @returns {Promise<Object>} L'opération créée
 * @throws {Error} 429 si limite FREE atteinte, 400 si produit introuvable
 */
async function createOperation(userId, plan, data) {
  // — Vérification de la limite mensuelle FREE
  const limitCheck = await checkMonthlyLimit(userId, plan);
  if (!limitCheck.canCreate) {
    const err = new Error(
      `Limite mensuelle atteinte (${FREE_MONTHLY_OPS_LIMIT} opérations/mois). ` +
      'Passez au plan Pro pour des opérations illimitées.'
    );
    err.statusCode = 429;
    throw err;
  }

  // — Vérification optionnelle : si un product_id est fourni, il doit appartenir à l'utilisateur
  if (data.product_id) {
    const product = await db.query(
      'SELECT id FROM products WHERE id = $1 AND user_id = $2 AND is_active = true',
      [data.product_id, userId]
    );
    if (product.rowCount === 0) {
      const err = new Error('Produit introuvable ou ne vous appartient pas');
      err.statusCode = 400;
      throw err;
    }
  }

  // — INSERT en base de données
  const result = await db.query(
    `INSERT INTO operations
       (user_id, type, amount, article_name, quantity, description,
        op_date, supplier_name, product_id, receipt_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING
       id, user_id, type, amount, article_name, quantity,
       description, op_date, supplier_name, product_id,
       receipt_url, created_at, updated_at`,
    [
      userId,
      data.type,
      data.amount,
      data.article_name,
      data.quantity ?? 1,
      data.description  || null,
      data.op_date      || new Date(),
      data.supplier_name || null,
      data.product_id   || null,
      data.receipt_url  || null,
    ]
  );

  const operation = result.rows[0];

  // — Incrémenter le compteur Redis (plan FREE uniquement)
  if (plan === 'FREE') {
    const key = _monthlyOpsKey(userId);
    await cache.incr(key, _secondsUntilEndOfMonth());
  }

  // — Invalider le cache dashboard (les totaux ont changé)
  await cache.del(cache.KEYS.dashboardCache(userId));

  logger.info('[Operations] Opération créée', {
    userId,
    operationId: operation.id,
    type:        operation.type,
    amount:      operation.amount,
  });

  return operation;
}

// ---------------------------------------------------------------------------
// 3. LISTE DES OPÉRATIONS (paginée, filtrée)
// ---------------------------------------------------------------------------

/**
 * Retourne la liste paginée des opérations de l'utilisateur.
 *
 * @param {string} userId
 * @param {Object} filters - Filtres validés par listOperationsSchema
 * @returns {Promise<{ items: Object[], total: number, page: number, limit: number }>}
 */
async function getOperations(userId, filters) {
  const { page, limit, sort_by, sort_dir } = filters;
  const offset = (page - 1) * limit;

  // Colonnes de tri autorisées (whitelist pour éviter injection SQL)
  const ALLOWED_SORT = {
    op_date:    'o.op_date',
    amount:     'o.amount',
    created_at: 'o.created_at',
  };
  const sortColumn = ALLOWED_SORT[sort_by] || 'o.op_date';
  const sortDir    = sort_dir === 'ASC' ? 'ASC' : 'DESC';

  const { clause, params, nextIdx } = _buildWhereClause(userId, filters);

  // Requête COUNT pour la pagination
  const countResult = await db.query(
    `SELECT COUNT(*)::int AS total FROM operations o ${clause}`,
    params
  );
  const total = countResult.rows[0].total;

  // Requête principale avec pagination
  const dataResult = await db.query(
    `SELECT
       o.id,
       o.type,
       o.amount,
       o.article_name,
       o.quantity,
       o.description,
       o.op_date,
       o.supplier_name,
       o.product_id,
       o.receipt_url,
       o.created_at,
       o.updated_at,
       p.name AS product_name
     FROM operations o
     LEFT JOIN products p ON p.id = o.product_id
     ${clause}
     ORDER BY ${sortColumn} ${sortDir}
     LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`,
    [...params, limit, offset]
  );

  return {
    items: dataResult.rows,
    total,
    page,
    limit,
  };
}

// ---------------------------------------------------------------------------
// 4. DÉTAIL D'UNE OPÉRATION
// ---------------------------------------------------------------------------

/**
 * Retourne le détail d'une opération spécifique.
 * Vérifie l'ownership (l'opération doit appartenir à userId).
 *
 * @param {string} userId
 * @param {string} operationId - UUID
 * @returns {Promise<Object>}
 * @throws {Error} 404 si introuvable ou n'appartient pas à l'utilisateur
 */
async function getOperationById(userId, operationId) {
  const result = await db.query(
    `SELECT
       o.id, o.type, o.amount, o.article_name, o.quantity,
       o.description, o.op_date, o.supplier_name,
       o.product_id, o.receipt_url, o.created_at, o.updated_at,
       p.name AS product_name
     FROM operations o
     LEFT JOIN products p ON p.id = o.product_id
     WHERE o.id = $1 AND o.user_id = $2`,
    [operationId, userId]
  );

  if (result.rowCount === 0) {
    const err = new Error('Opération introuvable');
    err.statusCode = 404;
    throw err;
  }

  return result.rows[0];
}

// ---------------------------------------------------------------------------
// 5. MODIFIER UNE OPÉRATION
// ---------------------------------------------------------------------------

/**
 * Met à jour une ou plusieurs colonnes d'une opération existante.
 * Seul le propriétaire peut modifier son opération.
 *
 * @param {string} userId
 * @param {string} operationId
 * @param {Object} data - Données validées par updateOperationSchema (champs partiels)
 * @returns {Promise<Object>} L'opération mise à jour
 * @throws {Error} 404 si introuvable
 */
async function updateOperation(userId, operationId, data) {
  // Vérifier que l'opération existe et appartient à l'utilisateur
  await getOperationById(userId, operationId);

  // Construire dynamiquement le SET SQL depuis les champs fournis
  const allowedFields = [
    'type', 'amount', 'article_name', 'quantity', 'description',
    'op_date', 'supplier_name', 'product_id', 'receipt_url',
  ];

  const setClauses = [];
  const params     = [];
  let   idx        = 1;

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      setClauses.push(`${field} = $${idx++}`);
      params.push(data[field] === '' ? null : data[field]);
    }
  }

  if (setClauses.length === 0) {
    const err = new Error('Aucun champ valide fourni pour la mise à jour');
    err.statusCode = 400;
    throw err;
  }

  // updated_at mis à jour automatiquement par le trigger SQL
  params.push(operationId, userId);

  const result = await db.query(
    `UPDATE operations
     SET ${setClauses.join(', ')}
     WHERE id = $${idx} AND user_id = $${idx + 1}
     RETURNING
       id, type, amount, article_name, quantity, description,
       op_date, supplier_name, product_id, receipt_url,
       created_at, updated_at`,
    params
  );

  // Invalider le cache dashboard
  await cache.del(cache.KEYS.dashboardCache(userId));

  logger.info('[Operations] Opération modifiée', { userId, operationId });

  return result.rows[0];
}

// ---------------------------------------------------------------------------
// 6. SUPPRIMER UNE OPÉRATION
// ---------------------------------------------------------------------------

/**
 * Supprime définitivement une opération.
 * Seul le propriétaire peut supprimer son opération.
 *
 * @param {string} userId
 * @param {string} operationId
 * @returns {Promise<void>}
 * @throws {Error} 404 si introuvable
 */
async function deleteOperation(userId, operationId) {
  // Vérifier ownership avant de supprimer
  await getOperationById(userId, operationId);

  await db.query(
    'DELETE FROM operations WHERE id = $1 AND user_id = $2',
    [operationId, userId]
  );

  // Décrémenter le compteur Redis si applicable (plan FREE, mois courant)
  // Note : on récupère le plan depuis la DB pour être précis
  const userResult = await db.query('SELECT plan FROM users WHERE id = $1', [userId]);
  if (userResult.rows[0]?.plan === 'FREE') {
    const key = _monthlyOpsKey(userId);
    const raw = await cache.get(key);
    if (raw && parseInt(raw, 10) > 0) {
      await cache.redis.decr(key);
    }
  }

  // Invalider le cache dashboard
  await cache.del(cache.KEYS.dashboardCache(userId));

  logger.info('[Operations] Opération supprimée', { userId, operationId });
}

// ---------------------------------------------------------------------------
// 7. RÉSUMÉ JOURNALIER
// ---------------------------------------------------------------------------

/**
 * Calcule le solde et les totaux par type pour un jour donné.
 *
 * @param {string} userId
 * @param {Date|string} date
 * @returns {Promise<Object>} Résumé du jour
 */
async function getDailySummary(userId, date) {
  const targetDate = date ? new Date(date) : new Date();
  const dayStart   = startOfDay(targetDate);
  const dayEnd     = endOfDay(targetDate);

  const result = await db.query(
    `SELECT
       type,
       COUNT(*)::int        AS count,
       COALESCE(SUM(amount), 0)::bigint AS total
     FROM operations
     WHERE user_id = $1
       AND op_date >= $2
       AND op_date <= $3
     GROUP BY type`,
    [userId, dayStart, dayEnd]
  );

  // Construire un résumé structuré avec toutes les catégories
  const summary = {
    date:      format(targetDate, 'yyyy-MM-dd'),
    VENTE:    { count: 0, total: 0 },
    ACHAT:    { count: 0, total: 0 },
    DEPENSE:  { count: 0, total: 0 },
    RECETTE:  { count: 0, total: 0 },
  };

  for (const row of result.rows) {
    summary[row.type] = { count: row.count, total: Number(row.total) };
  }

  // Solde du jour = (Ventes + Recettes) - (Achats + Dépenses)
  summary.balance =
    (summary.VENTE.total + summary.RECETTE.total) -
    (summary.ACHAT.total + summary.DEPENSE.total);

  summary.total_income  = summary.VENTE.total + summary.RECETTE.total;
  summary.total_expense = summary.ACHAT.total + summary.DEPENSE.total;

  return summary;
}

// ---------------------------------------------------------------------------
// 8. RÉSUMÉ MENSUEL
// ---------------------------------------------------------------------------

/**
 * Calcule les totaux par type pour un mois donné.
 * Inclut les totaux semaine par semaine pour les graphiques.
 *
 * @param {string} userId
 * @param {number} year
 * @param {number} month - 1..12
 * @returns {Promise<Object>}
 */
async function getMonthlySummary(userId, year, month) {
  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd   = endOfMonth(new Date(year, month - 1, 1));

  // — Totaux par type
  const totalsResult = await db.query(
    `SELECT
       type,
       COUNT(*)::int                    AS count,
       COALESCE(SUM(amount), 0)::bigint AS total
     FROM operations
     WHERE user_id = $1
       AND op_date >= $2
       AND op_date <= $3
     GROUP BY type`,
    [userId, monthStart, monthEnd]
  );

  const summary = {
    year,
    month,
    period: `${year}-${String(month).padStart(2, '0')}`,
    VENTE:   { count: 0, total: 0 },
    ACHAT:   { count: 0, total: 0 },
    DEPENSE: { count: 0, total: 0 },
    RECETTE: { count: 0, total: 0 },
  };

  for (const row of totalsResult.rows) {
    summary[row.type] = { count: row.count, total: Number(row.total) };
  }

  summary.total_income  = summary.VENTE.total + summary.RECETTE.total;
  summary.total_expense = summary.ACHAT.total + summary.DEPENSE.total;
  summary.net_balance   = summary.total_income - summary.total_expense;

  // — Évolution journalière (pour graphique courbe)
  const dailyResult = await db.query(
    `SELECT
       DATE(op_date)                    AS day,
       type,
       COALESCE(SUM(amount), 0)::bigint AS total
     FROM operations
     WHERE user_id = $1
       AND op_date >= $2
       AND op_date <= $3
     GROUP BY DATE(op_date), type
     ORDER BY day ASC`,
    [userId, monthStart, monthEnd]
  );

  // Regrouper par jour
  const dailyMap = {};
  for (const row of dailyResult.rows) {
    const day = row.day;
    if (!dailyMap[day]) dailyMap[day] = { day, VENTE: 0, ACHAT: 0, DEPENSE: 0, RECETTE: 0 };
    dailyMap[day][row.type] = Number(row.total);
  }
  summary.daily_breakdown = Object.values(dailyMap);

  // — Quota FREE : nombre d'opérations ce mois
  const key        = _monthlyOpsKey(userId, monthStart);
  const rawCounter = await cache.get(key);
  summary.monthly_ops_count = rawCounter ? parseInt(rawCounter, 10) : (
    // Fallback si le compteur Redis n'existe pas (ex: après redémarrage)
    summary.VENTE.count + summary.ACHAT.count + summary.DEPENSE.count + summary.RECETTE.count
  );

  return summary;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  FREE_MONTHLY_OPS_LIMIT,
  checkMonthlyLimit,
  createOperation,
  getOperations,
  getOperationById,
  updateOperation,
  deleteOperation,
  getDailySummary,
  getMonthlySummary,
};
