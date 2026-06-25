'use strict';

/**
 * Utilitaire JWT — LISSAFI-P
 *
 * Deux types de tokens :
 * - Access token  : courte durée (15 min), contient userId + plan
 * - Refresh token : longue durée (30 j), stocké hashé en base
 */

const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config/env');
const logger = require('./logger');

// ---------------------------------------------------------------------------
// Générer les deux tokens d'une session
// ---------------------------------------------------------------------------

/**
 * Génère un access token et un refresh token pour un utilisateur.
 *
 * @param {Object} payload
 * @param {string} payload.userId
 * @param {string} payload.plan  - 'FREE' | 'PRO'
 * @returns {{ accessToken: string, refreshToken: string, refreshTokenHash: string }}
 */
function generateTokens({ userId, plan }) {
  const accessToken = jwt.sign(
    { sub: userId, plan },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpiresIn }
  );

  // Le refresh token est une chaîne aléatoire signée
  // On stocke son hash SHA-256 en base (jamais le token brut)
  const refreshToken = jwt.sign(
    { sub: userId },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );

  const refreshTokenHash = hashToken(refreshToken);

  return { accessToken, refreshToken, refreshTokenHash };
}

// ---------------------------------------------------------------------------
// Vérifier un access token
// ---------------------------------------------------------------------------

/**
 * Vérifie et décode un access token JWT.
 * Retourne le payload ou lève une erreur.
 *
 * @param {string} token
 * @returns {{ sub: string, plan: string, iat: number, exp: number }}
 * @throws {jwt.JsonWebTokenError | jwt.TokenExpiredError}
 */
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, config.jwt.accessSecret);
  } catch (err) {
    logger.debug('[JWT] Access token invalide', { error: err.message });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Vérifier un refresh token
// ---------------------------------------------------------------------------

/**
 * Vérifie et décode un refresh token JWT.
 *
 * @param {string} token
 * @returns {{ sub: string, iat: number, exp: number }}
 * @throws {jwt.JsonWebTokenError | jwt.TokenExpiredError}
 */
function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, config.jwt.refreshSecret);
  } catch (err) {
    logger.debug('[JWT] Refresh token invalide', { error: err.message });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Hasher un token (pour le stockage en base)
// ---------------------------------------------------------------------------

/**
 * Calcule le hash SHA-256 d'un token brut.
 * On ne stocke jamais le token brut en base de données.
 *
 * @param {string} token
 * @returns {string} Hash hexadécimal
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ---------------------------------------------------------------------------
// Extraire le Bearer token d'un header Authorization
// ---------------------------------------------------------------------------

/**
 * Extrait le token JWT du header Authorization.
 * Format attendu : "Bearer <token>"
 *
 * @param {string|undefined} authHeader
 * @returns {string|null}
 */
function extractBearerToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7).trim() || null;
}

module.exports = {
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  extractBearerToken,
};
