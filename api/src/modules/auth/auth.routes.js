'use strict';

/**
 * Routes Auth — LISSAFI-P
 *
 * Toutes les routes du module M1 (Authentification & Profil).
 *
 * Convention :
 *   - Routes publiques  : validator → controller
 *   - Routes protégées  : authenticate → [requirePro] → validator → controller
 *
 * Rate limiting spécifique aux endpoints sensibles (brute force protection).
 * Les limites globales sont déjà appliquées dans app.js.
 *
 * Endpoints exposés :
 *   POST   /api/v1/auth/register         Inscription
 *   POST   /api/v1/auth/verify-otp       Vérification OTP
 *   POST   /api/v1/auth/set-password     Définition du mot de passe (après OTP)
 *   POST   /api/v1/auth/login            Connexion
 *   POST   /api/v1/auth/refresh          Renouvellement de l'access token
 *   POST   /api/v1/auth/logout           Déconnexion
 *   POST   /api/v1/auth/resend-otp       Renvoi du code OTP
 *   GET    /api/v1/auth/me               Profil utilisateur connecté
 *   PATCH  /api/v1/auth/me               Mise à jour du profil
 *   PATCH  /api/v1/auth/me/password      Changement de mot de passe
 */

const router      = require('express').Router();
const rateLimit   = require('express-rate-limit');

const controller  = require('./auth.controller');
const { authenticate } = require('../../middleware/authenticate');
const {
  validate,
  registerSchema,
  verifyOtpSchema,
  setPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  logoutSchema,
  resendOtpSchema,
  updateProfileSchema,
  changePasswordSchema,
} = require('./auth.validator');

// ---------------------------------------------------------------------------
// Rate limiters spécifiques au module Auth
// ---------------------------------------------------------------------------

/**
 * Limiter strict pour les endpoints qui envoient des SMS OTP.
 * Max 5 tentatives / 15 min par IP pour éviter les abus et coûts Twilio.
 */
const otpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      5,
  message:  {
    success: false,
    message: 'Trop de tentatives OTP. Réessayez dans 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders:   false,
});

/**
 * Limiter pour la connexion : 10 tentatives / 15 min par IP.
 * Protège contre les attaques brute force sur le mot de passe à 4 chiffres.
 */
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10,
  message:  {
    success: false,
    message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders:   false,
});

// ---------------------------------------------------------------------------
// Routes publiques (pas de JWT requis)
// ---------------------------------------------------------------------------

/**
 * @route  POST /api/v1/auth/register
 * @desc   Inscription — crée le compte et envoie un OTP
 * @access Public
 * @body   { phone?, email?, activity_type?, boutique_name? }
 */
router.post('/register',
  otpRateLimiter,
  validate(registerSchema),
  controller.register
);

/**
 * @route  POST /api/v1/auth/verify-otp
 * @desc   Vérification du code OTP reçu par SMS ou email
 * @access Public
 * @body   { identifier, token }
 */
router.post('/verify-otp',
  otpRateLimiter,
  validate(verifyOtpSchema),
  controller.verifyOtp
);

/**
 * @route  POST /api/v1/auth/set-password
 * @desc   Définition du mot de passe après la vérification OTP initiale
 * @access Public (userId fourni par verify-otp)
 * @body   { userId, password }
 */
router.post('/set-password',
  validate(setPasswordSchema),
  controller.setPassword
);

/**
 * @route  POST /api/v1/auth/login
 * @desc   Connexion avec identifiant + mot de passe 4 chiffres
 * @access Public
 * @body   { identifier, password }
 */
router.post('/login',
  loginRateLimiter,
  validate(loginSchema),
  controller.login
);

/**
 * @route  POST /api/v1/auth/refresh
 * @desc   Renouvelle l'access token à partir d'un refresh token valide
 * @access Public (refresh token = authentification implicite)
 * @body   { refresh_token }
 */
router.post('/refresh',
  validate(refreshTokenSchema),
  controller.refreshToken
);

/**
 * @route  POST /api/v1/auth/resend-otp
 * @desc   Renvoie un nouvel OTP — réponse identique qu'il existe ou non
 * @access Public
 * @body   { identifier }
 */
router.post('/resend-otp',
  otpRateLimiter,
  validate(resendOtpSchema),
  controller.resendOtp
);

// ---------------------------------------------------------------------------
// Routes protégées (JWT obligatoire)
// ---------------------------------------------------------------------------

/**
 * @route  POST /api/v1/auth/logout
 * @desc   Déconnexion — révoque le refresh token de la session courante
 * @access Privé
 * @body   { refresh_token }
 */
router.post('/logout',
  authenticate,
  validate(logoutSchema),
  controller.logout
);

/**
 * @route  GET /api/v1/auth/me
 * @desc   Récupère le profil complet de l'utilisateur connecté
 * @access Privé
 */
router.get('/me',
  authenticate,
  controller.getProfile
);

/**
 * @route  PATCH /api/v1/auth/me
 * @desc   Met à jour les informations du profil
 * @access Privé
 * @body   { boutique_name?, address?, description?, activity_type?,
 *           work_hours_start?, work_hours_end? }
 */
router.patch('/me',
  authenticate,
  validate(updateProfileSchema),
  controller.updateProfile
);

/**
 * @route  PATCH /api/v1/auth/me/password
 * @desc   Change le mot de passe — révoque toutes les sessions existantes
 * @access Privé
 * @body   { current_password, new_password }
 */
router.patch('/me/password',
  authenticate,
  validate(changePasswordSchema),
  controller.changePassword
);

module.exports = router;
