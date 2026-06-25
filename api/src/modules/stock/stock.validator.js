'use strict';

/**
 * Validateurs Joi — Module Stock (M3)
 *
 * Règles métier appliquées (CDC §2.4.2) :
 * - Trois types de mouvements : ENTREE, SORTIE, AJUSTEMENT
 * - ENTREE / SORTIE : quantity = delta (≥ 1 unité)
 * - AJUSTEMENT      : quantity = nouveau total (≥ 0, permet de remettre à zéro)
 * - Une raison peut être fournie pour tracer les mouvements manuels
 */

const Joi            = require('joi');
const { badRequest } = require('../../utils/response');

// ---------------------------------------------------------------------------
// Constante exportée (utilisée par le service et dans les messages d'erreur)
// ---------------------------------------------------------------------------

const MOVEMENT_TYPES = ['ENTREE', 'SORTIE', 'AJUSTEMENT'];

// ---------------------------------------------------------------------------
// Schéma 1 — Créer un mouvement de stock
// POST /api/v1/stock/movement
// ---------------------------------------------------------------------------

const createMovementSchema = Joi.object({
  /** Produit concerné — obligatoire */
  product_id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid':  'L\'identifiant produit est invalide',
      'any.required': 'L\'identifiant du produit est obligatoire',
    }),

  /**
   * Type de mouvement :
   * - ENTREE    : réception de marchandises (delta positif)
   * - SORTIE    : vente ou consommation (delta négatif)
   * - AJUSTEMENT: correction d'inventaire (nouvelle valeur absolue)
   */
  movement_type: Joi.string()
    .valid(...MOVEMENT_TYPES)
    .required()
    .messages({
      'any.only':   `Type invalide. Valeurs acceptées : ${MOVEMENT_TYPES.join(', ')}`,
      'any.required': 'Le type de mouvement est obligatoire',
    }),

  /**
   * Quantité du mouvement :
   * - ENTREE / SORTIE    : nombre d'unités ajoutées / retirées (≥ 1)
   * - AJUSTEMENT         : nouveau total en stock (≥ 0)
   */
  quantity: Joi.number()
    .integer()
    .min(0)
    .max(9_999_999)
    .required()
    .messages({
      'number.base':    'La quantité doit être un nombre',
      'number.integer': 'La quantité doit être un entier',
      'number.min':     'La quantité ne peut pas être négative',
      'any.required':   'La quantité est obligatoire',
    }),

  /** Motif facultatif — utile pour les ajustements manuels */
  reason: Joi.string()
    .trim()
    .max(255)
    .optional()
    .allow('', null)
    .messages({
      'string.max': 'La raison ne peut pas dépasser 255 caractères',
    }),
});

// ---------------------------------------------------------------------------
// Schéma 2 — Filtres pour l'historique des mouvements d'un produit
// GET /api/v1/stock/movements/:productId?page=1&limit=20
// ---------------------------------------------------------------------------

const listMovementsSchema = Joi.object({
  /** Filtrer par type de mouvement */
  movement_type: Joi.string()
    .valid(...MOVEMENT_TYPES)
    .optional()
    .messages({ 'any.only': `Type invalide. Valeurs : ${MOVEMENT_TYPES.join(', ')}` }),

  /** Pagination */
  page:  Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

// ---------------------------------------------------------------------------
// Middleware validate() — même pattern que les autres modules
// ---------------------------------------------------------------------------

/**
 * @param {Joi.Schema}      schema
 * @param {'body'|'query'}  source
 * @returns {import('express').RequestHandler}
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly:   false,
      stripUnknown: true,
      convert:      true,
    });

    if (error) {
      const errors = error.details.map((d) => ({
        field:   d.context?.key || d.path.join('.'),
        message: d.message,
      }));
      return badRequest(res, 'Données invalides', errors);
    }

    req[source] = value;
    return next();
  };
}

module.exports = {
  MOVEMENT_TYPES,
  createMovementSchema,
  listMovementsSchema,
  validate,
};
