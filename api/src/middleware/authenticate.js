'use strict';

/**
 * Middleware d'authentification — LISSAFI-P
 *
 * Vérifie la présence et la validité du JWT dans le header Authorization.
 * Injecte { userId, plan } dans req.user pour les controllers en aval.
 *
 * Usage :
 *   router.get('/me', authenticate, authController.getProfile);
 *
 * Middleware optionnel (ex: routes publiques avec infos enrichies si connecté) :
 *   router.get('/boutique/:id', authenticateOptional, boutiqueController.getPublic);
 */

const { verifyAccessToken, extractBearerToken } = require('../utils/jwt');
const { unauthorized, forbidden }               = require('../utils/response');
const logger                                    = require('../utils/logger');

// ---------------------------------------------------------------------------
// authenticate — obligatoire
// ---------------------------------------------------------------------------

/**
 * Middleware principal : rejette la requête si le token est absent ou invalide.
 *
 * @type {import('express').RequestHandler}
 */
function authenticate(req, res, next) {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    return unauthorized(res, 'Token d\'authentification manquant. Veuillez vous connecter.');
  }

  try {
    const payload = verifyAccessToken(token);

    // Injecter les infos utilisateur pour les controllers
    req.user = {
      userId: payload.sub,
      plan:   payload.plan,  // 'FREE' | 'PRO'
    };

    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return unauthorized(res, 'Session expirée. Veuillez vous reconnecter.');
    }
    logger.debug('[Auth] Token JWT invalide', { error: err.message, ip: req.ip });
    return unauthorized(res, 'Token d\'authentification invalide.');
  }
}

// ---------------------------------------------------------------------------
// authenticateOptional — ne bloque pas les non-connectés
// ---------------------------------------------------------------------------

/**
 * Middleware optionnel : injecte req.user si un token valide est fourni,
 * mais laisse passer la requête même sans token.
 *
 * @type {import('express').RequestHandler}
 */
function authenticateOptional(req, res, next) {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { userId: payload.sub, plan: payload.plan };
  } catch {
    req.user = null; // Token invalide — on ignore silencieusement
  }

  return next();
}

// ---------------------------------------------------------------------------
// requirePro — à chaîner APRÈS authenticate
// ---------------------------------------------------------------------------

/**
 * Middleware de garde : bloque l'accès aux fonctionnalités Pro pour les
 * utilisateurs en plan FREE.
 *
 * @type {import('express').RequestHandler}
 */
function requirePro(req, res, next) {
  if (!req.user || req.user.plan !== 'PRO') {
    return forbidden(res, 'Cette fonctionnalité est réservée au plan Pro. Passez à Pro pour y accéder.');
  }
  return next();
}

module.exports = {
  authenticate,
  authenticateOptional,
  requirePro,
};
