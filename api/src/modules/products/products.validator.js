'use strict';

/**
 * Validateurs Joi — Module Products (M3)
 *
 * Règles métier appliquées (CDC §2.4) :
 * - Plan FREE : 20 produits actifs maximum
 * - Les prix sont en FCFA (entiers positifs)
 * - La quantité initiale de stock peut être nulle (0)
 * - Le seuil d'alerte de stock est configurable par produit
 * - Suppression logique uniquement (soft delete via is_active)
 */

const Joi            = require('joi');
const { badRequest } = require('../../utils/response');

// ---------------------------------------------------------------------------
// Règles de base réutilisables
// ---------------------------------------------------------------------------

/** Prix en FCFA : entier, 0 ou positif */
const price = Joi.number()
  .integer()
  .min(0)
  .max(999_999_999)
  .messages({
    'number.base':    'Le prix doit être un nombre',
    'number.integer': 'Le prix doit être un entier (en FCFA)',
    'number.min':     'Le prix ne peut pas être négatif',
    'number.max':     'Le prix ne peut pas dépasser 999 999 999 FCFA',
  });

/** Quantité entière non négative */
const qty = Joi.number()
  .integer()
  .min(0)
  .max(9_999_999)
  .messages({
    'number.base':    'La quantité doit être un nombre',
    'number.integer': 'La quantité doit être un entier',
    'number.min':     'La quantité ne peut pas être négative',
  });

// ---------------------------------------------------------------------------
// Schéma 1 — Création d'un produit
// POST /api/v1/products
// ---------------------------------------------------------------------------

const createProductSchema = Joi.object({
  /** Nom du produit — obligatoire */
  name: Joi.string()
    .trim()
    .min(1)
    .max(150)
    .required()
    .messages({
      'string.min':   'Le nom du produit ne peut pas être vide',
      'string.max':   'Le nom du produit ne peut pas dépasser 150 caractères',
      'any.required': 'Le nom du produit est obligatoire',
    }),

  /** Description facultative */
  description: Joi.string()
    .trim()
    .max(500)
    .optional()
    .allow('', null)
    .messages({
      'string.max': 'La description ne peut pas dépasser 500 caractères',
    }),

  /**
   * Unité de mesure — ex : PCS, KG, L, M, CARTON, SAC, BOITE...
   * Champ libre pour s'adapter à tous les secteurs
   */
  unit: Joi.string()
    .trim()
    .min(1)
    .max(30)
    .default('PCS')
    .optional()
    .messages({
      'string.max': 'L\'unité ne peut pas dépasser 30 caractères',
    }),

  /** Prix d'achat (coût) — optionnel */
  purchase_price: price.optional().allow(null).messages({
    'any.optional': 'Le prix d\'achat est optionnel',
  }),

  /** Prix de vente — optionnel */
  sale_price: price.optional().allow(null).messages({
    'any.optional': 'Le prix de vente est optionnel',
  }),

  /** Stock initial — défaut 0 */
  stock_qty: qty.default(0).optional(),

  /**
   * Seuil d'alerte de rupture de stock.
   * Quand stock_qty <= ce seuil, une alerte est générée.
   * Défaut : 5 unités
   */
  alert_threshold: Joi.number()
    .integer()
    .min(0)
    .max(999_999)
    .default(5)
    .optional()
    .messages({
      'number.min': 'Le seuil d\'alerte ne peut pas être négatif',
    }),
});

// ---------------------------------------------------------------------------
// Schéma 2 — Modification d'un produit
// PUT /api/v1/products/:id
// ---------------------------------------------------------------------------

const updateProductSchema = Joi.object({
  name:                  Joi.string().trim().min(1).max(150).optional(),
  description:           Joi.string().trim().max(500).optional().allow('', null),
  unit:                  Joi.string().trim().min(1).max(30).optional(),
  purchase_price:        price.optional().allow(null),
  sale_price:            price.optional().allow(null),
  alert_threshold: Joi.number().integer().min(0).max(999_999).optional(),
}).min(1).messages({
  'object.min': 'Au moins un champ à modifier est requis',
});

// ---------------------------------------------------------------------------
// Schéma 3 — Filtres pour la liste paginée
// GET /api/v1/products?search=sucre&low_stock_only=true&page=1
// ---------------------------------------------------------------------------

const listProductsSchema = Joi.object({
  /** Recherche textuelle (nom du produit) */
  search: Joi.string().trim().max(100).optional().allow(''),

  /** Ne retourner que les produits en rupture / sous le seuil d'alerte */
  low_stock_only: Joi.boolean().optional().default(false),

  /** Pagination */
  page:  Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),

  /** Tri */
  sort_by:  Joi.string()
    .valid('name', 'stock_qty', 'sale_price', 'created_at')
    .default('name'),
  sort_dir: Joi.string().valid('ASC', 'DESC').default('ASC'),
});

// ---------------------------------------------------------------------------
// Middleware validate() — réutilisable sur toutes les routes
// TODO: centraliser dans src/utils/validate.js quand les autres modules arrivent
// ---------------------------------------------------------------------------

/**
 * Crée un middleware Express qui valide req.body ou req.query avec le schéma Joi.
 *
 * @param {Joi.Schema}       schema
 * @param {'body'|'query'}   source - Par défaut 'body'
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
  createProductSchema,
  updateProductSchema,
  listProductsSchema,
  validate,
};
