'use strict';

/**
 * Helpers pour les réponses HTTP de l'API LISSAFI-P.
 *
 * Format uniforme de toutes les réponses :
 *
 * Succès :
 * {
 *   "success": true,
 *   "message": "Opération enregistrée",
 *   "data":    { ... }
 * }
 *
 * Erreur :
 * {
 *   "success": false,
 *   "message": "Ressource introuvable",
 *   "errors":  [ ... ]   // optionnel — détail des erreurs de validation
 * }
 */

/**
 * Réponse de succès.
 *
 * @param {import('express').Response} res
 * @param {*}      data
 * @param {string} message
 * @param {number} statusCode - HTTP 200 par défaut
 */
function ok(res, data = null, message = 'Succès', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

/**
 * Réponse de création (HTTP 201).
 */
function created(res, data = null, message = 'Ressource créée') {
  return ok(res, data, message, 201);
}

/**
 * Réponse sans contenu (HTTP 204 — utilisé pour DELETE).
 */
function noContent(res) {
  return res.status(204).send();
}

/**
 * Réponse d'erreur générique.
 *
 * @param {import('express').Response} res
 * @param {string} message
 * @param {number} statusCode
 * @param {Array}  errors     - Détails optionnels (validation Joi, etc.)
 */
function error(res, message, statusCode = 400, errors = []) {
  const body = { success: false, message };
  if (errors.length > 0) body.errors = errors;
  return res.status(statusCode).json(body);
}

/**
 * 400 — Données invalides (validation Joi).
 */
function badRequest(res, message = 'Données invalides', errors = []) {
  return error(res, message, 400, errors);
}

/**
 * 401 — Non authentifié.
 */
function unauthorized(res, message = 'Authentification requise') {
  return error(res, message, 401);
}

/**
 * 403 — Authentifié mais pas autorisé (ex: fonctionnalité Pro).
 */
function forbidden(res, message = 'Accès refusé') {
  return error(res, message, 403);
}

/**
 * 403 spécifique — Fonctionnalité réservée au plan Pro.
 */
function proRequired(res) {
  return forbidden(res, 'Cette fonctionnalité est réservée au plan Pro. Passez à Pro pour y accéder.');
}

/**
 * 404 — Ressource introuvable.
 */
function notFound(res, message = 'Ressource introuvable') {
  return error(res, message, 404);
}

/**
 * 409 — Conflit (doublon, état incompatible).
 */
function conflict(res, message = 'Conflit de données') {
  return error(res, message, 409);
}

/**
 * 429 — Trop de requêtes (rate limit).
 */
function tooManyRequests(res, message = 'Trop de tentatives. Réessayez dans quelques minutes.') {
  return error(res, message, 429);
}

/**
 * 500 — Erreur serveur interne.
 */
function serverError(res, message = 'Erreur interne du serveur') {
  return error(res, message, 500);
}

/**
 * Réponse paginée standardisée.
 *
 * @param {import('express').Response} res
 * @param {Array}  items
 * @param {number} total   - Nombre total d'éléments (sans pagination)
 * @param {number} page    - Page courante (1-indexé)
 * @param {number} limit   - Taille de la page
 * @param {string} message
 */
function paginated(res, items, total, page, limit, message = 'Succès') {
  return res.status(200).json({
    success: true,
    message,
    data: {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext:    page * limit < total,
        hasPrev:    page > 1,
      },
    },
  });
}

module.exports = {
  ok,
  created,
  noContent,
  error,
  badRequest,
  unauthorized,
  forbidden,
  proRequired,
  notFound,
  conflict,
  tooManyRequests,
  serverError,
  paginated,
};
