'use strict';

/**
 * Validateurs Joi — Module Operations (M2)
 *
 * Règles métier appliquées (CDC §2.3.2) :
 * - Tout montant est obligatoirement en FCFA (entier positif)
 * - La date peut être rétroactive (saisie différée autorisée)
 * - Un commentaire facultatif de 255 caractères maximum
 * - Les types d'opération : VENTE, ACHAT, DEPENSE, RECETTE
 * - En version gratuite : 30 opérations par mois maximum
 */

const Joi            = require('joi');
const { badRequest } = require('../../utils/response');

// ---------------------------------------------------------------------------
// Types d'opération — ENUM métier
// ---------------------------------------------------------------------------

const OPERATION_TYPES = ['VENTE', 'ACHAT', 'DEPENSE', 'RECETTE'];

// ---------------------------------------------------------------------------
// Règles de base réutilisables
// ---------------------------------------------------------------------------

/** Montant en FCFA : entier, minimum 1, maximum 999 999 999 */
const amount = Joi.number()
  .integer()
  .min(1)
  .max(999_999_999)
  .messages({
    'number.base':    'Le montant doit être un nombre',
    'number.integer': 'Le montant doit être un entier (en FCFA)',
    'number.min':     'Le montant doit être supérieur à 0 FCFA',
    'number.max':     'Le montant ne peut pas dépasser 999 999 999 FCFA',
  });

/** Date ISO 8601 — peut être dans le passé (saisie différée) */
const opDate = Joi.date()
  .iso()
  .max('now')
  .messages({
    'date.base':   'La date est invalide',
    'date.format': 'La date doit être au format ISO 8601 (ex: 2026-05-04)',
    'date.max':    'La date ne peut pas être dans le futur',
  });

/** Commentaire facultatif — 255 caractères max */
const notes = Joi.string()
  .trim()
  .max(255)
  .optional()
  .allow('', null)
  .messages({
    'string.max': 'Le commentaire ne peut pas dépasser 255 caractères',
  });

// ---------------------------------------------------------------------------
// Schéma 1 — Création d'une opération
// POST /api/v1/operations
// ---------------------------------------------------------------------------

const createOperationSchema = Joi.object({
  /** Type obligatoire */
  type: Joi.string()
    .valid(...OPERATION_TYPES)
    .required()
    .messages({
      'any.only':   `Le type d'opération est invalide. Valeurs acceptées : ${OPERATION_TYPES.join(', ')}`,
      'any.required': 'Le type d\'opération est obligatoire',
    }),

  /** Montant obligatoire */
  amount: amount.required().messages({
    'any.required': 'Le montant est obligatoire',
  }),

  /** Nom de l'article ou de l'opération */
  article_name: Joi.string()
    .trim()
    .min(1)
    .max(150)
    .required()
    .messages({
      'string.min':   'Le nom de l\'article ne peut pas être vide',
      'string.max':   'Le nom de l\'article ne peut pas dépasser 150 caractères',
      'any.required': 'Le nom de l\'article est obligatoire',
    }),

  /** Quantité — facultative, défaut 1 */
  quantity: Joi.number()
    .integer()
    .min(1)
    .max(999_999)
    .default(1)
    .optional()
    .messages({
      'number.integer': 'La quantité doit être un entier',
      'number.min':     'La quantité doit être supérieure à 0',
    }),

  /** Description facultative */
  description: notes,

  /** Date de l'opération — défaut : maintenant */
  op_date: opDate.default(() => new Date()).optional(),

  /** Nom du client ou fournisseur lié (optionnel) */
  supplier_name: Joi.string()
    .trim()
    .max(150)
    .optional()
    .allow('', null)
    .messages({
      'string.max': 'Le nom du tiers ne peut pas dépasser 150 caractères',
    }),

  /** Lien vers produit du catalogue (optionnel) */
  product_id: Joi.string()
    .uuid()
    .optional()
    .allow(null)
    .messages({
      'string.guid': 'L\'identifiant produit est invalide',
    }),

  /** URL de la pièce jointe (reçu photo) — ajouté par upload middleware */
  receipt_url: Joi.string()
    .uri()
    .max(500)
    .optional()
    .allow('', null),
});

// ---------------------------------------------------------------------------
// Schéma 2 — Modification d'une opération
// PUT /api/v1/operations/:id
// ---------------------------------------------------------------------------

const updateOperationSchema = Joi.object({
  type: Joi.string()
    .valid(...OPERATION_TYPES)
    .optional()
    .messages({
      'any.only': `Type invalide. Valeurs acceptées : ${OPERATION_TYPES.join(', ')}`,
    }),

  amount:           amount.optional(),
  article_name:     Joi.string().trim().min(1).max(150).optional(),
  quantity:         Joi.number().integer().min(1).max(999_999).optional(),
  description:      notes,
  op_date:          opDate.optional(),
  supplier_name: Joi.string().trim().max(150).optional().allow('', null),
  product_id:       Joi.string().uuid().optional().allow(null),
  receipt_url:      Joi.string().uri().max(500).optional().allow('', null),
}).min(1).messages({
  'object.min': 'Au moins un champ doit être fourni pour la mise à jour',
});

// ---------------------------------------------------------------------------
// Schéma 3 — Filtres pour la liste paginée
// GET /api/v1/operations?type=VENTE&page=1&limit=20
// ---------------------------------------------------------------------------

const listOperationsSchema = Joi.object({
  /** Filtrer par type d'opération */
  type: Joi.string()
    .valid(...OPERATION_TYPES)
    .optional()
    .messages({
      'any.only': `Type invalide. Valeurs acceptées : ${OPERATION_TYPES.join(', ')}`,
    }),

  /** Plage de dates */
  date_from: opDate.optional().messages({
    'date.max': 'La date de début ne peut pas être dans le futur',
  }),
  date_to: Joi.date().iso().optional().messages({
    'date.format': 'La date de fin doit être au format ISO 8601',
  }),

  /** Montant min/max */
  amount_min: Joi.number().integer().min(0).optional(),
  amount_max: Joi.number().integer().min(0).optional(),

  /** Recherche textuelle (article_name ou supplier_name) */
  search: Joi.string().trim().max(100).optional().allow(''),

  /** Pagination */
  page:  Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),

  /** Tri */
  sort_by:  Joi.string().valid('op_date', 'amount', 'created_at').default('op_date'),
  sort_dir: Joi.string().valid('ASC', 'DESC').default('DESC'),
}).with('amount_min', 'amount_max').messages({
  'object.with': 'amount_min et amount_max doivent être fournis ensemble',
});

// ---------------------------------------------------------------------------
// Schéma 4 — Paramètres pour le résumé journalier
// GET /api/v1/operations/summary/daily?date=2026-05-04
// ---------------------------------------------------------------------------

const dailySummarySchema = Joi.object({
  date: opDate.optional().default(() => new Date()),
});

// ---------------------------------------------------------------------------
// Schéma 5 — Paramètres pour le résumé mensuel
// GET /api/v1/operations/summary/monthly?year=2026&month=5
// ---------------------------------------------------------------------------

const monthlySummarySchema = Joi.object({
  year:  Joi.number().integer().min(2020).max(2100).default(() => new Date().getFullYear()),
  month: Joi.number().integer().min(1).max(12).default(() => new Date().getMonth() + 1),
});

// ---------------------------------------------------------------------------
// Middleware validate() — réutilisable sur toutes les routes
// ---------------------------------------------------------------------------

/**
 * Crée un middleware Express qui valide req.body (ou req.query) avec le schéma Joi donné.
 * En cas d'erreur, renvoie immédiatement un 400 avec le détail des champs invalides.
 *
 * @param {Joi.Schema} schema    - Schéma Joi à appliquer
 * @param {'body'|'query'} source - Source à valider (défaut: 'body')
 * @returns {import('express').RequestHandler}
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly:   false,   // retourner toutes les erreurs d'un coup
      stripUnknown: true,    // ignorer les champs non déclarés dans le schéma
      convert:      true,    // convertir automatiquement les types (string → number, etc.)
    });

    if (error) {
      const errors = error.details.map((d) => ({
        field:   d.context?.key || d.path.join('.'),
        message: d.message,
      }));
      return badRequest(res, 'Données invalides', errors);
    }

    // Remplacer la source par les valeurs validées et converties (avec les defaults)
    req[source] = value;
    return next();
  };
}

module.exports = {
  OPERATION_TYPES,
  createOperationSchema,
  updateOperationSchema,
  listOperationsSchema,
  dailySummarySchema,
  monthlySummarySchema,
  validate,
};
