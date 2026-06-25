'use strict';

/**
 * Routes Products — Module M3 LISSAFI-P
 *
 * Toutes les routes exigent une authentification JWT.
 * Convention : routes fixes AVANT les routes paramétrées (/:id)
 * pour éviter les conflits Express.
 *
 * Préfixe monté dans app.js : /api/v1/products
 *
 * Routes :
 *   GET    /limits   → quota du plan (FREE : 20 produits max)
 *   GET    /         → liste paginée du catalogue
 *   POST   /         → créer un produit
 *   GET    /:id      → détail d'un produit
 *   PUT    /:id      → modifier un produit
 *   DELETE /:id      → désactiver un produit (soft delete)
 */

const router = require('express').Router();

const { authenticate }    = require('../../middleware/authenticate');
const controller          = require('./products.controller');
const {
  validate,
  createProductSchema,
  updateProductSchema,
  listProductsSchema,
} = require('./products.validator');

// Toutes les routes exigent un JWT valide
router.use(authenticate);

// GET /limits — quota de produits (AVANT /:id pour éviter le conflit)
router.get('/limits', controller.getProductsLimit);

// GET / — liste paginée du catalogue
router.get('/', validate(listProductsSchema, 'query'), controller.listProducts);

// POST / — créer un produit
router.post('/', validate(createProductSchema), controller.createProduct);

// GET /:id — détail d'un produit
router.get('/:id', controller.getProduct);

// PUT /:id — modifier un produit
router.put('/:id', validate(updateProductSchema), controller.updateProduct);

// DELETE /:id — désactiver un produit (soft delete)
router.delete('/:id', controller.deleteProduct);

module.exports = router;
