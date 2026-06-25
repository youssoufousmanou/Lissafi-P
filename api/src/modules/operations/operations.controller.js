'use strict';

/**
 * Contrôleur Operations — Module M2 LISSAFI-P
 *
 * Couche HTTP pure : extraction req → appel service → réponse formatée.
 * Aucune logique métier ici — tout est dans operations.service.js.
 *
 * Endpoints :
 *   GET    /api/v1/operations                   → liste paginée
 *   POST   /api/v1/operations                   → créer une opération
 *   GET    /api/v1/operations/summary/daily      → solde journalier
 *   GET    /api/v1/operations/summary/monthly    → résumé mensuel
 *   GET    /api/v1/operations/:id               → détail
 *   PUT    /api/v1/operations/:id               → modifier
 *   DELETE /api/v1/operations/:id               → supprimer
 */

const operationsService = require('./operations.service');
const response          = require('../../utils/response');
const logger            = require('../../utils/logger');

// ---------------------------------------------------------------------------
// Helper : centraliser la gestion des erreurs du service
// ---------------------------------------------------------------------------

/**
 * Mappe les erreurs métier du service vers des réponses HTTP appropriées.
 *
 * @param {import('express').Response} res
 * @param {Error}  err
 * @param {string} context - Pour les logs
 */
function handleServiceError(res, err, context) {
  logger.error(`[Operations] Erreur ${context}`, {
    message:    err.message,
    statusCode: err.statusCode,
  });

  const status = err.statusCode || 500;

  switch (status) {
    case 400: return response.badRequest(res, err.message);
    case 404: return response.notFound(res, err.message);
    case 409: return response.conflict(res, err.message);
    case 429: return response.tooManyRequests(res, err.message);
    default:  return response.serverError(res, err.message);
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/operations
// ---------------------------------------------------------------------------

/**
 * Liste paginée des opérations de l'utilisateur connecté.
 * Supporte les filtres : type, date_from, date_to, search, amount_min/max.
 *
 * Query : { type?, date_from?, date_to?, search?, page?, limit?, sort_by?, sort_dir? }
 * Réponse 200 : { items: Operation[], pagination: {...} }
 */
async function listOperations(req, res) {
  try {
    const { userId } = req.user;
    const filters    = req.query; // déjà validé + converti par le validator

    const result = await operationsService.getOperations(userId, filters);

    return response.paginated(
      res,
      result.items,
      result.total,
      result.page,
      result.limit,
      'Opérations récupérées avec succès'
    );
  } catch (err) {
    return handleServiceError(res, err, 'listOperations');
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/operations
// ---------------------------------------------------------------------------

/**
 * Crée une nouvelle opération commerciale.
 *
 * Body : { type, amount, article_name, quantity?, description?, op_date?,
 *          supplier_name?, product_id?, receipt_url? }
 * Réponse 201 : Operation créée
 */
async function createOperation(req, res) {
  try {
    const { userId, plan } = req.user;
    const data             = req.body; // validé par createOperationSchema

    const operation = await operationsService.createOperation(userId, plan, data);

    return response.created(
      res,
      operation,
      'Opération enregistrée avec succès'
    );
  } catch (err) {
    return handleServiceError(res, err, 'createOperation');
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/operations/summary/daily
// ---------------------------------------------------------------------------

/**
 * Solde et totaux du jour (ou d'une date choisie).
 *
 * Query : { date? } — défaut : aujourd'hui
 * Réponse 200 : { date, VENTE, ACHAT, DEPENSE, RECETTE, balance, total_income, total_expense }
 */
async function getDailySummary(req, res) {
  try {
    const { userId } = req.user;
    const { date }   = req.query; // validé par dailySummarySchema

    const summary = await operationsService.getDailySummary(userId, date);

    return response.ok(res, summary, 'Résumé journalier calculé');
  } catch (err) {
    return handleServiceError(res, err, 'getDailySummary');
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/operations/summary/monthly
// ---------------------------------------------------------------------------

/**
 * Résumé mensuel complet : totaux par type, solde net, évolution journalière.
 *
 * Query : { year?, month? } — défaut : mois courant
 * Réponse 200 : résumé mensuel avec daily_breakdown
 */
async function getMonthlySummary(req, res) {
  try {
    const { userId } = req.user;
    const { year, month } = req.query; // validé par monthlySummarySchema

    const summary = await operationsService.getMonthlySummary(
      userId,
      Number(year),
      Number(month)
    );

    return response.ok(res, summary, 'Résumé mensuel calculé');
  } catch (err) {
    return handleServiceError(res, err, 'getMonthlySummary');
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/operations/:id
// ---------------------------------------------------------------------------

/**
 * Détail d'une opération spécifique.
 *
 * Params : { id: UUID }
 * Réponse 200 : Operation
 */
async function getOperation(req, res) {
  try {
    const { userId } = req.user;
    const { id }     = req.params;

    const operation = await operationsService.getOperationById(userId, id);

    return response.ok(res, operation, 'Opération récupérée');
  } catch (err) {
    return handleServiceError(res, err, 'getOperation');
  }
}

// ---------------------------------------------------------------------------
// PUT /api/v1/operations/:id
// ---------------------------------------------------------------------------

/**
 * Modifie une opération existante (remplacement partiel).
 *
 * Params : { id: UUID }
 * Body   : champs partiels à modifier
 * Réponse 200 : Operation mise à jour
 */
async function updateOperation(req, res) {
  try {
    const { userId } = req.user;
    const { id }     = req.params;
    const data       = req.body; // validé par updateOperationSchema

    const operation = await operationsService.updateOperation(userId, id, data);

    return response.ok(res, operation, 'Opération mise à jour avec succès');
  } catch (err) {
    return handleServiceError(res, err, 'updateOperation');
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/v1/operations/:id
// ---------------------------------------------------------------------------

/**
 * Supprime définitivement une opération.
 *
 * Params : { id: UUID }
 * Réponse 204 : No Content
 */
async function deleteOperation(req, res) {
  try {
    const { userId } = req.user;
    const { id }     = req.params;

    await operationsService.deleteOperation(userId, id);

    return response.noContent(res);
  } catch (err) {
    return handleServiceError(res, err, 'deleteOperation');
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/operations/limits
// ---------------------------------------------------------------------------

/**
 * Retourne le quota d'opérations du mois courant (utile pour l'UI mobile).
 *
 * Réponse 200 : { count, limit, canCreate, plan }
 */
async function getMonthlyLimit(req, res) {
  try {
    const { userId, plan } = req.user;

    const limits = await operationsService.checkMonthlyLimit(userId, plan);

    return response.ok(res, { ...limits, plan }, 'Quota mensuel récupéré');
  } catch (err) {
    return handleServiceError(res, err, 'getMonthlyLimit');
  }
}

module.exports = {
  listOperations,
  createOperation,
  getDailySummary,
  getMonthlySummary,
  getOperation,
  updateOperation,
  deleteOperation,
  getMonthlyLimit,
};
