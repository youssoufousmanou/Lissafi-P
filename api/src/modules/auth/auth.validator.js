'use strict';

/**
 * Validateurs Joi — Module Auth
 *
 * Chaque schéma valide le corps (body) de la requête entrante.
 * Le middleware validate() est réutilisable sur toutes les routes du projet.
 *
 * Règles métier appliquées ici (CDC §2.2.2) :
 * - Un compte est lié à un seul numéro de téléphone OU e-mail
 * - Le mot de passe doit contenir exactement 4 chiffres
 * - Le code OTP est à 6 chiffres et expire après 10 minutes
 */

const Joi = require('joi');
const { badRequest } = require('../../utils/response');

// ---------------------------------------------------------------------------
// Règles de base réutilisables
// ---------------------------------------------------------------------------

const phone = Joi
  .string()
  .pattern(/^\+?[1-9]\d{7,14}$/)
  .messages({
    'string.pattern.base': 'Le numéro de téléphone est invalide. Format attendu : +237XXXXXXXXX',
  });

const email = Joi
  .string()
  .email({ tlds: { allow: false } })
  .lowercase()
  .trim()
  .messages({
    'string.email': 'L\'adresse e-mail est invalide',
  });

// Mot de passe : exactement 4 chiffres (règle métier CDC M1)
const password = Joi
  .string()
  .pattern(/^\d{4}$/)
  .messages({
    'string.pattern.base': 'Le mot de passe doit contenir exactement 4 chiffres',
  });

// Identifiant : numéro de téléphone OU e-mail
const identifier = Joi.alternatives()
  .try(phone, email)
  .messages({
    'alternatives.match': 'Veuillez fournir un numéro de téléphone ou une adresse e-mail valide',
  });

// ---------------------------------------------------------------------------
// Schéma 1 — Inscription
// POST /auth/register
// ---------------------------------------------------------------------------

const registerSchema = Joi.object({
  phone:         phone.optional(),
  email:         email.optional(),
  activity_type: Joi.string()
    .valid(
      'COMMERCE_GENERAL',
      'MECANIQUE',
      'COUTURE',
      'COIFFURE',
      'ALIMENTATION',
      'AGRICULTURE',
      'SERVICES',
      'AUTRE'
    )
    .default('COMMERCE_GENERAL')
    .messages({
      'any.only': 'Type d\'activité invalide. Valeurs acceptées : COMMERCE_GENERAL, MECANIQUE, COUTURE, COIFFURE, ALIMENTATION, AGRICULTURE, SERVICES, AUTRE',
    }),
  boutique_name: Joi.string().trim().max(150).optional(),
}).or('phone', 'email').messages({
  'object.missing': 'Un numéro de téléphone ou une adresse e-mail est obligatoire',
});

// ---------------------------------------------------------------------------
// Schéma 2 — Vérification OTP
// POST /auth/verify-otp
// ---------------------------------------------------------------------------

const verifyOtpSchema = Joi.object({
  identifier: identifier.required().messages({
    'any.required': 'L\'identifiant (téléphone ou e-mail) est obligatoire',
  }),
  token: Joi.string()
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.pattern.base': 'Le code OTP doit contenir exactement 6 chiffres',
      'any.required':        'Le code OTP est obligatoire',
    }),
});

// ---------------------------------------------------------------------------
// Schéma 3 — Connexion
// POST /auth/login
// ---------------------------------------------------------------------------

const loginSchema = Joi.object({
  identifier: identifier.required().messages({
    'any.required': 'L\'identifiant (téléphone ou e-mail) est obligatoire',
  }),
  password: password.required().messages({
    'any.required': 'Le mot de passe est obligatoire',
  }),
});

// ---------------------------------------------------------------------------
// Schéma 4 — Création du mot de passe (après OTP)
// POST /auth/set-password
// ---------------------------------------------------------------------------

const setPasswordSchema = Joi.object({
  userId:   Joi.string().uuid().required().messages({
    'string.guid':  'L\'identifiant utilisateur est invalide',
    'any.required': 'L\'identifiant utilisateur est obligatoire',
  }),
  password: password.required().messages({
    'any.required': 'Le mot de passe est obligatoire',
  }),
});

// ---------------------------------------------------------------------------
// Schéma 5 — Renouvellement du token
// POST /auth/refresh
// ---------------------------------------------------------------------------

const refreshTokenSchema = Joi.object({
  refresh_token: Joi.string().required().messages({
    'any.required': 'Le refresh token est obligatoire',
  }),
});

// ---------------------------------------------------------------------------
// Schéma 6 — Déconnexion
// POST /auth/logout
// ---------------------------------------------------------------------------

const logoutSchema = Joi.object({
  refresh_token: Joi.string().required().messages({
    'any.required': 'Le refresh token est obligatoire',
  }),
});

// ---------------------------------------------------------------------------
// Schéma 7 — Renvoi d'OTP
// POST /auth/resend-otp
// ---------------------------------------------------------------------------

const resendOtpSchema = Joi.object({
  identifier: identifier.required().messages({
    'any.required': 'L\'identifiant (téléphone ou e-mail) est obligatoire',
  }),
});

// ---------------------------------------------------------------------------
// Schéma 5 — Mise à jour du profil
// PATCH /auth/me
// ---------------------------------------------------------------------------

const updateProfileSchema = Joi.object({
  boutique_name:   Joi.string().trim().max(150).optional(),
  address:         Joi.string().trim().max(255).optional(),
  description:     Joi.string().trim().max(500).optional(),
  activity_type:   Joi.string()
    .valid(
      'COMMERCE_GENERAL', 'MECANIQUE', 'COUTURE', 'COIFFURE',
      'ALIMENTATION', 'AGRICULTURE', 'SERVICES', 'AUTRE'
    )
    .optional(),
  work_hours_start: Joi.string()
    .pattern(/^\d{2}:\d{2}$/)
    .optional()
    .messages({ 'string.pattern.base': 'Format d\'heure invalide. Exemple : 08:00' }),
  work_hours_end:   Joi.string()
    .pattern(/^\d{2}:\d{2}$/)
    .optional()
    .messages({ 'string.pattern.base': 'Format d\'heure invalide. Exemple : 18:00' }),
}).min(1).messages({
  'object.min': 'Au moins un champ à modifier est requis',
});

// ---------------------------------------------------------------------------
// Schéma 6 — Changement de mot de passe
// PATCH /auth/me/password
// ---------------------------------------------------------------------------

const changePasswordSchema = Joi.object({
  current_password: password.required().messages({
    'any.required': 'Le mot de passe actuel est obligatoire',
  }),
  new_password: password.required().messages({
    'any.required': 'Le nouveau mot de passe est obligatoire',
  }),
}).custom((value, helpers) => {
  if (value.current_password === value.new_password) {
    return helpers.error('any.invalid');
  }
  return value;
}).messages({
  'any.invalid': 'Le nouveau mot de passe doit être différent de l\'actuel',
});

// ---------------------------------------------------------------------------
// Middleware factory — réutilisable sur toutes les routes
// ---------------------------------------------------------------------------

/**
 * Crée un middleware Express qui valide req.body contre un schéma Joi.
 * En cas d'erreur, retourne une réponse 400 avec le détail des champs invalides.
 *
 * @param {Joi.ObjectSchema} schema - Schéma de validation
 * @returns {Function} Middleware Express
 *
 * @example
 * router.post('/login', validate(loginSchema), authController.login);
 */
function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly:   false,   // collecter TOUTES les erreurs, pas juste la première
      stripUnknown: true,    // supprimer les champs non déclarés dans le schéma
      convert:      true,    // convertir les types (string → number, etc.)
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field:   detail.context?.key || detail.context?.peers?.join(', '),
        message: detail.message,
      }));
      return badRequest(res, 'Données invalides', errors);
    }

    // Remplacer req.body par les données validées et nettoyées
    req.body = value;
    return next();
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  // Schémas
  registerSchema,
  verifyOtpSchema,
  setPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  logoutSchema,
  resendOtpSchema,
  updateProfileSchema,
  changePasswordSchema,

  // Middleware factory
  validate,
};
