'use strict';

/**
 * Contrôleur Auth — LISSAFI-P
 *
 * Couche HTTP du module d'authentification.
 * Responsabilités strictes :
 *   - Extraire les données de la requête (req.body, req.user)
 *   - Appeler le service Auth
 *   - Formater et renvoyer la réponse HTTP standardisée
 *
 * Ce fichier ne contient AUCUNE logique métier — tout est dans auth.service.js.
 */

const authService = require('./auth.service');
const response    = require('../../utils/response');
const logger      = require('../../utils/logger');

// ---------------------------------------------------------------------------
// POST /api/v1/auth/register
// ---------------------------------------------------------------------------

/**
 * Inscription d'un nouveau commerçant.
 * Crée le compte et envoie un OTP de vérification (SMS ou email).
 *
 * Body : { phone?, email?, activity_type?, boutique_name? }
 * Réponse 201 : { userId, identifier }
 */
async function register(req, res) {
  try {
    const result = await authService.register(req.body);
    return response.created(res, result,
      'Compte créé avec succès. Un code de vérification a été envoyé.'
    );
  } catch (err) {
    return handleServiceError(res, err, 'register');
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/auth/verify-otp
// ---------------------------------------------------------------------------

/**
 * Vérifie le code OTP soumis par l'utilisateur.
 * Si le compte n'a pas encore de mot de passe, indique qu'il faut en créer un.
 *
 * Body : { identifier, token }
 * Réponse 200 : { userId, requiresPassword }
 */
async function verifyOtp(req, res) {
  try {
    const { identifier, token } = req.body;
    const result = await authService.verifyOtp(identifier, token);

    const message = result.requiresPassword
      ? 'Code vérifié. Veuillez définir votre mot de passe pour continuer.'
      : 'Code vérifié avec succès.';

    return response.ok(res, result, message);
  } catch (err) {
    return handleServiceError(res, err, 'verifyOtp');
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/auth/set-password
// ---------------------------------------------------------------------------

/**
 * Définit le mot de passe après la vérification OTP initiale.
 * Déclenche une connexion automatique et retourne les tokens de session.
 *
 * Body : { userId, password }
 * Réponse 200 : { accessToken, refreshToken, user }
 */
async function setPassword(req, res) {
  try {
    const { userId, password } = req.body;
    const result = await authService.setPassword(userId, password);
    return response.ok(res, result, 'Mot de passe défini. Bienvenue sur LISSAFI-P !');
  } catch (err) {
    return handleServiceError(res, err, 'setPassword');
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/auth/login
// ---------------------------------------------------------------------------

/**
 * Connexion avec identifiant + mot de passe.
 *
 * Body : { identifier, password }
 * Réponse 200 : { accessToken, refreshToken, user }
 */
async function login(req, res) {
  try {
    const { identifier, password } = req.body;
    const result = await authService.login(identifier, password);
    return response.ok(res, result, 'Connexion réussie. Bienvenue !');
  } catch (err) {
    return handleServiceError(res, err, 'login');
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/auth/refresh
// ---------------------------------------------------------------------------

/**
 * Renouvelle l'access token à partir d'un refresh token valide.
 *
 * Body : { refresh_token }
 * Réponse 200 : { accessToken }
 */
async function refreshToken(req, res) {
  try {
    const result = await authService.refreshAccessToken(req.body.refresh_token);
    return response.ok(res, result, 'Token renouvelé avec succès.');
  } catch (err) {
    return handleServiceError(res, err, 'refreshToken');
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/auth/logout
// ---------------------------------------------------------------------------

/**
 * Déconnexion — révoque le refresh token de la session courante.
 *
 * Body : { refresh_token }
 * Réponse 200 : null
 *
 * Requiert : authenticate middleware (req.user.userId injecté)
 */
async function logout(req, res) {
  try {
    const { userId } = req.user;
    const { refresh_token } = req.body;
    await authService.logout(userId, refresh_token);
    return response.ok(res, null, 'Déconnexion réussie.');
  } catch (err) {
    return handleServiceError(res, err, 'logout');
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/auth/resend-otp
// ---------------------------------------------------------------------------

/**
 * Renvoie un nouvel OTP à l'identifiant donné.
 * Répond toujours 200 pour ne pas révéler si le compte existe.
 *
 * Body : { identifier }
 * Réponse 200 : null
 */
async function resendOtp(req, res) {
  try {
    await authService.resendOtp(req.body.identifier);
    // Réponse identique même si l'identifiant n'existe pas (sécurité)
    return response.ok(res, null,
      'Si un compte est associé à cet identifiant, un nouveau code a été envoyé.'
    );
  } catch (err) {
    return handleServiceError(res, err, 'resendOtp');
  }
}

// ---------------------------------------------------------------------------
// GET /api/v1/auth/me
// ---------------------------------------------------------------------------

/**
 * Retourne le profil de l'utilisateur connecté.
 *
 * Réponse 200 : { user }
 *
 * Requiert : authenticate middleware
 */
async function getProfile(req, res) {
  try {
    const user = await authService.getProfile(req.user.userId);
    return response.ok(res, { user }, 'Profil récupéré avec succès.');
  } catch (err) {
    return handleServiceError(res, err, 'getProfile');
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/v1/auth/me
// ---------------------------------------------------------------------------

/**
 * Met à jour les informations du profil utilisateur.
 *
 * Body : { boutique_name?, address?, description?, activity_type?,
 *          work_hours_start?, work_hours_end? }
 * Réponse 200 : { user }
 *
 * Requiert : authenticate middleware
 */
async function updateProfile(req, res) {
  try {
    const user = await authService.updateProfile(req.user.userId, req.body);
    return response.ok(res, { user }, 'Profil mis à jour avec succès.');
  } catch (err) {
    return handleServiceError(res, err, 'updateProfile');
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/v1/auth/me/password
// ---------------------------------------------------------------------------

/**
 * Change le mot de passe de l'utilisateur connecté.
 * Révoque toutes les sessions existantes après le changement.
 *
 * Body : { current_password, new_password }
 * Réponse 200 : null
 *
 * Requiert : authenticate middleware
 */
async function changePassword(req, res) {
  try {
    const { current_password, new_password } = req.body;
    await authService.changePassword(req.user.userId, current_password, new_password);
    return response.ok(res, null,
      'Mot de passe modifié avec succès. Veuillez vous reconnecter.'
    );
  } catch (err) {
    return handleServiceError(res, err, 'changePassword');
  }
}

// ---------------------------------------------------------------------------
// Helper privé — gestion centralisée des erreurs de service
// ---------------------------------------------------------------------------

/**
 * Mappe les statusCode du service vers les réponses HTTP adéquates.
 * Évite la duplication de try/catch dans chaque handler.
 *
 * @param {import('express').Response} res
 * @param {Error & { statusCode?: number }} err
 * @param {string} context - Nom de la méthode pour le log
 */
function handleServiceError(res, err, context) {
  const status = err.statusCode || 500;

  // Erreurs attendues (logique métier) — log debug
  if (status < 500) {
    logger.debug(`[AuthController] Erreur métier [${context}]`, {
      message: err.message,
      status,
    });
  } else {
    // Erreurs inattendues — log error avec stack
    logger.error(`[AuthController] Erreur inattendue [${context}]`, {
      message: err.message,
      stack:   err.stack,
    });
  }

  switch (status) {
    case 400: return response.badRequest(res, err.message);
    case 401: return response.unauthorized(res, err.message);
    case 403: return response.forbidden(res, err.message);
    case 404: return response.notFound(res, err.message);
    case 409: return response.conflict(res, err.message);
    default:  return response.serverError(res, 'Une erreur inattendue s\'est produite.');
  }
}

module.exports = {
  register,
  verifyOtp,
  setPassword,
  login,
  refreshToken,
  logout,
  resendOtp,
  getProfile,
  updateProfile,
  changePassword,
};
