'use strict';

/**
 * Contrôleur Stock — Module M3 LISSAFI-P
 *
 * Couche HTTP pure : extraction req → appel service → réponse formatée.
 *
 * Endpoints :
 *   POST   /api/v1/stock/movement              → enregistrer un mouvement
 *   GET    /api/v1/stock/alerts                → produits sous le seuil d'alerte
 *   GET    /api/v1/stock/valuation             → valorisation totale du stock
 *   GET    /api/v1/stock/movements/:productId  → historique d'un produit
 */

const stockService = require('./stock.service');
const response     = require('../../utils/response');
const logger       = require('../../utils/logger');
const config       = require('../../config/env');

// ---------------------------------------------------------------------------
// Helper : gestion centralisée des erreurs
// ---------------------------------------------------------------------------

function handleServiceError(res, err, context) {
  const status = err.statusCode || 500;

  if (status < 500) {
    logger.debug(`[Stock] Erreur métier [${context}]`, { message: err.message, status });
  } else {
    logger.error(`[Stock] Erreur inattendue [${context}]`, { message: err.message, stack: err.stack });
  }

  switch (status) {
    case 400: return response.badRequest(res, err.message);
    case 404: return response.notFound(res, err.message);
    case 409: return response.conflict(res, err.message);
    default:  return response.serverError(res, config.isProd ? 'Erreur interne' : err.message);
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/stock/movement
// ---------------------------------------------------------------------------

/**
 * Enregistre un mouvement de stock.
 * Le type du mouvement (ENTREE / SORTIE / AJUSTEMENT) détermine la logique.
 *
 * Body : { product_id, movement_type, quantity, reason? }
 * Réponse 201 : mouvement créé avec quantités avant/après
 */
async function createMovement(req, res) {
  try {
    const { userId } = req.user;
    const movement = await stockService.createMovement(userId, req.body);
    return response.created(res, movement, 'Mouvement de stock enregistré');
  } catch (err) {
    return handleServiceError(res, err, 'createMovement');
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/stock/alerts
// ---------------------------------------------------------------------------

/**
 * Retourne la liste des produits en rupture ou sous le seuil d'alerte.
 * Résultat caché 5 minutes dans Redis.
 *
 * Réponse 200 : Product[] (avec stock_deficit calculé)
 */
async function getAlerts(req, res) {
  try {
    const { userId } = req.user;
    const alerts = await stockService.getAlerts(userId);

    return response.ok(
      res,
      { alerts, count: alerts.length },
      alerts.length > 0
        ? `${alerts.length} produit(s) en alerte de stock`
        : 'Aucun produit en alerte de stock'
    );
  } catch (err) {
    return handleServiceError(res, err, 'getAlerts');
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/stock/valuation
// ---------------------------------------------------------------------------

/**
 * Retourne la valorisation totale du stock (au prix d'achat et de vente).
 * Résultat caché 5 minutes dans Redis.
 *
 * Réponse 200 : { product_count, total_units, total_purchase_value,
 *                 total_sale_value, alert_count, top_products }
 */
async function getValuation(req, res) {
  try {
    const { userId } = req.user;
    const valuation = await stockService.getValuation(userId);
    return response.ok(res, valuation, 'Valorisation du stock calculée');
  } catch (err) {
    return handleServiceError(res, err, 'getValuation');
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/stock/movements/:productId
// ---------------------------------------------------------------------------

/**
 * Retourne l'historique paginé des mouvements de stock d'un produit.
 *
 * Params : { productId: UUID }
 * Query  : { movement_type?, page?, limit? }
 * Réponse 200 : { items: StockMovement[], pagination: {...} }
 */
async function getMovements(req, res) {
  try {
    const { userId }   = req.user;
    const { productId } = req.params;
    const filters      = req.query; // validé par listMovementsSchema

    const result = await stockService.getMovements(userId, productId, filters);

    return response.paginated(
      res,
      result.items,
      result.total,
      result.page,
      result.limit,
      'Historique des mouvements récupéré'
    );
  } catch (err) {
    return handleServiceError(res, err, 'getMovements');
  }
}

module.exports = {
  createMovement,
  getAlerts,
  getValuation,
  getMovements,
};
