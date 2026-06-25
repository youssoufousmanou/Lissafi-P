'use strict';

/**
 * Contrôleur Products — Module M3 LISSAFI-P
 *
 * Couche HTTP pure : extraction req → appel service → réponse formatée.
 * Aucune logique métier ici — tout est dans products.service.js.
 *
 * Endpoints :
 *   GET    /api/v1/products           → liste paginée du catalogue
 *   POST   /api/v1/products           → créer un produit
 *   GET    /api/v1/products/limits    → quota plan FREE
 *   GET    /api/v1/products/:id       → détail d'un produit
 *   PUT    /api/v1/products/:id       → modifier un produit
 *   DELETE /api/v1/products/:id       → désactiver un produit (soft delete)
 */

const productsService = require('./products.service');
const response        = require('../../utils/response');
const logger          = require('../../utils/logger');
const config          = require('../../config/env');

// ---------------------------------------------------------------------------
// Helper : gestion centralisée des erreurs de service
// ---------------------------------------------------------------------------

function handleServiceError(res, err, context) {
  const status = err.statusCode || 500;

  if (status < 500) {
    logger.debug(`[Products] Erreur métier [${context}]`, { message: err.message, status });
  } else {
    logger.error(`[Products] Erreur inattendue [${context}]`, { message: err.message, stack: err.stack });
  }

  switch (status) {
    case 400: return response.badRequest(res, err.message);
    case 404: return response.notFound(res, err.message);
    case 409: return response.conflict(res, err.message);
    case 429: return response.tooManyRequests(res, err.message);
    default:  return response.serverError(res, config.isProd ? 'Erreur interne' : err.message);
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/products/limits
// ---------------------------------------------------------------------------

/**
 * Retourne le quota de produits du plan courant.
 * Utile pour l'affichage dans l'UI mobile avant la création.
 *
 * Réponse 200 : { count, limit, canCreate, plan }
 */
async function getProductsLimit(req, res) {
  try {
    const { userId, plan } = req.user;
    const limits = await productsService.checkProductsLimit(userId, plan);
    return response.ok(res, { ...limits, plan }, 'Quota produits récupéré');
  } catch (err) {
    return handleServiceError(res, err, 'getProductsLimit');
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/products
// ---------------------------------------------------------------------------

/**
 * Liste paginée du catalogue produits de l'utilisateur.
 *
 * Query : { search?, low_stock_only?, page?, limit?, sort_by?, sort_dir? }
 * Réponse 200 : { items: Product[], pagination: {...} }
 */
async function listProducts(req, res) {
  try {
    const { userId } = req.user;
    const result = await productsService.getProducts(userId, req.query);

    return response.paginated(
      res,
      result.items,
      result.total,
      result.page,
      result.limit,
      'Catalogue récupéré avec succès'
    );
  } catch (err) {
    return handleServiceError(res, err, 'listProducts');
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/products
// ---------------------------------------------------------------------------

/**
 * Crée un nouveau produit dans le catalogue.
 *
 * Body : { name, unit?, description?, purchase_price?, sale_price?,
 *          stock_qty?, alert_threshold? }
 * Réponse 201 : Produit créé
 */
async function createProduct(req, res) {
  try {
    const { userId, plan } = req.user;
    const product = await productsService.createProduct(userId, plan, req.body);
    return response.created(res, product, 'Produit ajouté au catalogue');
  } catch (err) {
    return handleServiceError(res, err, 'createProduct');
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/products/:id
// ---------------------------------------------------------------------------

/**
 * Retourne le détail d'un produit.
 *
 * Params : { id: UUID }
 * Réponse 200 : Product
 */
async function getProduct(req, res) {
  try {
    const { userId } = req.user;
    const product = await productsService.getProductById(userId, req.params.id);
    return response.ok(res, product, 'Produit récupéré');
  } catch (err) {
    return handleServiceError(res, err, 'getProduct');
  }
}

// ---------------------------------------------------------------------------
// PUT /api/v1/products/:id
// ---------------------------------------------------------------------------

/**
 * Modifie les informations d'un produit.
 * Note : la quantité en stock se gère via /api/v1/stock.
 *
 * Params : { id: UUID }
 * Body   : champs partiels
 * Réponse 200 : Produit mis à jour
 */
async function updateProduct(req, res) {
  try {
    const { userId } = req.user;
    const product = await productsService.updateProduct(userId, req.params.id, req.body);
    return response.ok(res, product, 'Produit mis à jour');
  } catch (err) {
    return handleServiceError(res, err, 'updateProduct');
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/v1/products/:id
// ---------------------------------------------------------------------------

/**
 * Désactive un produit (soft delete — is_active = false).
 * L'historique des opérations liées reste intact.
 *
 * Params : { id: UUID }
 * Réponse 204 : No Content
 */
async function deleteProduct(req, res) {
  try {
    const { userId } = req.user;
    await productsService.deleteProduct(userId, req.params.id);
    return response.noContent(res);
  } catch (err) {
    return handleServiceError(res, err, 'deleteProduct');
  }
}

module.exports = {
  getProductsLimit,
  listProducts,
  createProduct,
  getProduct,
  updateProduct,
  deleteProduct,
};
