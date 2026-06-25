'use strict';

/**
 * Routes Operations — Module M2 LISSAFI-P
 *
 * Toutes les routes requièrent une authentification JWT (middleware authenticate).
 * Les filtres de liste sont validés via req.query.
 * Les corps de requête sont validés via req.body.
 *
 * Préfixe monté dans app.js : /api/v1/operations
 *
 * Routes :
 *   GET    /                    → liste paginée avec filtres
 *   POST   /                    → créer une opération
 *   GET    /limits              → quota mensuel du plan FREE
 *   GET    /summary/daily       → solde journalier
 *   GET    /summary/monthly     → résumé mensuel
 *   GET    /:id                 → détail d'une opération
 *   PUT    /:id                 → modifier une opération
 *   DELETE /:id                 → supprimer une opération
 */

const router = require('express').Router();

const { authenticate }     = require('../../middleware/authenticate');
const operationsController = require('./operations.controller');
const {
  validate,
  createOperationSchema,
  updateOperationSchema,
  listOperationsSchema,
  dailySummarySchema,
  monthlySummarySchema,
} = require('./operations.validator');

// ---------------------------------------------------------------------------
// Toutes les routes de ce module exigent un JWT valide
// ---------------------------------------------------------------------------
router.use(authenticate);

// ---------------------------------------------------------------------------
// GET /limits — quota mensuel (à placer AVANT /:id pour éviter le conflit)
// ---------------------------------------------------------------------------
router.get('/limits', operationsController.getMonthlyLimit);

// ---------------------------------------------------------------------------
// GET /summary/daily
// ---------------------------------------------------------------------------
router.get(
  '/summary/daily',
  validate(dailySummarySchema, 'query'),
  operationsController.getDailySummary
);

// ---------------------------------------------------------------------------
// GET /summary/monthly
// ---------------------------------------------------------------------------
router.get(
  '/summary/monthly',
  validate(monthlySummarySchema, 'query'),
  operationsController.getMonthlySummary
);

// ---------------------------------------------------------------------------
// GET / — liste paginée des opérations
// ---------------------------------------------------------------------------
router.get(
  '/',
  validate(listOperationsSchema, 'query'),
  operationsController.listOperations
);

// ---------------------------------------------------------------------------
// POST / — créer une nouvelle opération
// ---------------------------------------------------------------------------
router.post(
  '/',
  validate(createOperationSchema, 'body'),
  operationsController.createOperation
);

// ---------------------------------------------------------------------------
// GET /:id — détail d'une opération
// ---------------------------------------------------------------------------
router.get('/:id', operationsController.getOperation);

// ---------------------------------------------------------------------------
// PUT /:id — modifier une opération
// ---------------------------------------------------------------------------
router.put(
  '/:id',
  validate(updateOperationSchema, 'body'),
  operationsController.updateOperation
);

// ---------------------------------------------------------------------------
// DELETE /:id — supprimer une opération
// ---------------------------------------------------------------------------
router.delete('/:id', operationsController.deleteOperation);

module.exports = router;
