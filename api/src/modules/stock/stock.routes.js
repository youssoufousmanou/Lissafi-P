'use strict';

/**
 * Routes Stock — Module M3 LISSAFI-P
 *
 * Toutes les routes exigent une authentification JWT.
 * Convention : routes fixes AVANT les routes paramétrées pour éviter
 * les conflits Express.
 *
 * Préfixe monté dans app.js : /api/v1/stock
 *
 * Routes :
 *   POST   /movement              → enregistrer un mouvement de stock
 *   GET    /alerts                → produits sous le seuil d'alerte
 *   GET    /valuation             → valorisation totale du stock
 *   GET    /movements/:productId  → historique paginé d'un produit
 */

const router = require('express').Router();

const { authenticate } = require('../../middleware/authenticate');
const controller       = require('./stock.controller');
const {
  validate,
  createMovementSchema,
  listMovementsSchema,
} = require('./stock.validator');

// Toutes les routes exigent un JWT valide
router.use(authenticate);

// POST /movement — enregistrer un mouvement de stock
router.post(
  '/movement',
  validate(createMovementSchema, 'body'),
  controller.createMovement
);

// GET /alerts — produits en rupture ou sous le seuil d'alerte
router.get('/alerts', controller.getAlerts);

// GET /valuation — valorisation totale du stock
router.get('/valuation', controller.getValuation);

// GET /movements/:productId — historique paginé d'un produit
router.get(
  '/movements/:productId',
  validate(listMovementsSchema, 'query'),
  controller.getMovements
);

module.exports = router;
