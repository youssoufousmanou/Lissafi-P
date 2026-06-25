'use strict';

/**
 * Configuration de l'application Express LISSAFI-P.
 *
 * Ce fichier déclare l'app et tous ses middlewares globaux.
 * Il n'écoute PAS sur un port — c'est le rôle de server.js.
 * Cette séparation facilite les tests (supertest monte l'app sans le port).
 */

const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const compression  = require('compression');
const morgan       = require('morgan');
const rateLimit    = require('express-rate-limit');

const config   = require('./config/env');
const logger   = require('./utils/logger');
const response = require('./utils/response');
const { buildOpenApiSpec } = require('./docs/openapi');

// ---------------------------------------------------------------------------
// Import des routes par module
// ---------------------------------------------------------------------------
const authRoutes         = require('./modules/auth/auth.routes');
const operationsRoutes   = require('./modules/operations/operations.routes');
const productsRoutes     = require('./modules/products/products.routes');
const stockRoutes        = require('./modules/stock/stock.routes');
const clientsRoutes      = require('./modules/clients/clients.routes');
const visitsRoutes       = require('./modules/visits/visits.routes');
const chargesRoutes      = require('./modules/charges/charges.routes');
const boutiqueRoutes     = require('./modules/boutique/boutique.routes');
const reportsRoutes      = require('./modules/reports/reports.routes');
const subscriptionsRoutes= require('./modules/subscriptions/subscriptions.routes');

const app = express();

// ---------------------------------------------------------------------------
// Express rate-limit (req.ip / X-Forwarded-For)
// ---------------------------------------------------------------------------
app.set('trust proxy', 1);

// ---------------------------------------------------------------------------
// Sécurité — Helmet (headers HTTP défensifs)
// ---------------------------------------------------------------------------
app.use(helmet({
  contentSecurityPolicy: !config.isProd,
}));



// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
const corsOptions = {
  origin: config.isProd
    ? ['https://lissafi.cm', 'https://www.lissafi.cm', /\.lissafi\.cm$/]
    : '*',
  methods:          ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders:   ['Content-Type', 'Authorization'],
  exposedHeaders:   ['X-Total-Count'],  // pour la pagination
  credentials:      true,
  maxAge:           86400,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // preflight

// ---------------------------------------------------------------------------
// Compression des réponses (Gzip) — réduit la bande passante (3G/2G)
// ---------------------------------------------------------------------------
app.use(compression());

// ---------------------------------------------------------------------------
// Parsing du corps des requêtes
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '5mb' }));           // JSON body
app.use(express.urlencoded({ extended: true }));   // form-urlencoded

// ---------------------------------------------------------------------------
// Logs HTTP (Morgan → Winston)
// ---------------------------------------------------------------------------
app.use(morgan(config.isProd ? 'combined' : 'dev', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// ---------------------------------------------------------------------------
// Rate Limiting global
// ---------------------------------------------------------------------------
const globalLimiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs,  // 15 min
  max:      config.security.rateLimitMax,        // 100 req / 15 min par IP
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    message: 'Trop de requêtes depuis cette adresse. Réessayez dans quelques minutes.',
  },
  skip: () => config.isTest, // désactivé pendant les tests
});
app.use(globalLimiter);

// ---------------------------------------------------------------------------
// Rate Limiting spécifique pour les routes d'authentification
// (Protection brute-force OTP/login)
// ---------------------------------------------------------------------------
const authLimiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max:      config.security.rateLimitAuthMax,   // 10 tentatives / 15 min
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.',
  },
  skip: () => config.isTest,
});

// ---------------------------------------------------------------------------
// Endpoint de santé — sans authentification
// Utilisé par UptimeRobot, Railway health checks, etc.
// ---------------------------------------------------------------------------
app.get('/health', async (req, res) => {
  try {
    const db    = require('./config/db');
    const redis = require('./config/redis');

    const [dbHealth, redisHealth] = await Promise.allSettled([
      db.healthCheck(),
      redis.healthCheck(),
    ]);

    const status = {
      app:   'ok',
      db:    dbHealth.status    === 'fulfilled' ? dbHealth.value    : { status: 'error' },
      redis: redisHealth.status === 'fulfilled' ? redisHealth.value : { status: 'error' },
      uptime:    process.uptime(),
      timestamp: new Date().toISOString(),
    };

    const httpStatus = (status.db.status === 'ok') ? 200 : 503;
    return res.status(httpStatus).json(status);
  } catch (err) {
    logger.error('[Health] Échec du health check', { error: err.message });
    return res.status(503).json({ app: 'error', message: err.message });
  }
});

// ---------------------------------------------------------------------------
// Documentation OpenAPI / Swagger
// ---------------------------------------------------------------------------
app.get('/docs/openapi.json', (req, res) => {
  return res.json(buildOpenApiSpec());
});

app.get('/docs', (req, res) => {
  const specUrl = '/docs/openapi.json';

  return res.type('html').send(`<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>LISSAFI-P API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      html, body { margin: 0; padding: 0; background: #faf7f2; }
      .topbar { display: none; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '${specUrl}',
        dom_id: '#swagger-ui',
        deepLinking: true,
        displayRequestDuration: true,
        persistAuthorization: true,
      });
    </script>
  </body>
</html>`);
});

// ---------------------------------------------------------------------------
// Montage des routes avec préfixe API versionnée
// ---------------------------------------------------------------------------
const apiPrefix = `/api/${config.server.apiVersion}`;

app.use(`${apiPrefix}/auth`,          authLimiter, authRoutes);
app.use(`${apiPrefix}/operations`,    operationsRoutes);
app.use(`${apiPrefix}/products`,      productsRoutes);
app.use(`${apiPrefix}/stock`,         stockRoutes);
app.use(`${apiPrefix}/clients`,       clientsRoutes);
app.use(`${apiPrefix}/visits`,        visitsRoutes);
app.use(`${apiPrefix}/charges`,       chargesRoutes);
app.use(`${apiPrefix}/boutique`,      boutiqueRoutes);
app.use(`${apiPrefix}/reports`,       reportsRoutes);
app.use(`${apiPrefix}/subscriptions`, subscriptionsRoutes);

// ---------------------------------------------------------------------------
// Route 404 — toute route non trouvée
// ---------------------------------------------------------------------------
app.use((req, res) => {
  return response.notFound(res, `Route introuvable : ${req.method} ${req.originalUrl}`);
});

// ---------------------------------------------------------------------------
// Gestionnaire d'erreurs global (doit avoir 4 paramètres)
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Erreur de parsing JSON malformé
  if (err.type === 'entity.parse.failed') {
    return response.badRequest(res, 'Corps de la requête JSON invalide');
  }

  // Erreur de validation Joi (si propagée via next(err))
  if (err.isJoi) {
    const errors = err.details.map((d) => ({
      field:   d.context?.key,
      message: d.message,
    }));
    return response.badRequest(res, 'Données invalides', errors);
  }

  logger.error('[App] Erreur non gérée', {
    error:  err.message,
    stack:  config.isDev ? err.stack : undefined,
    url:    req.originalUrl,
    method: req.method,
  });

  return response.serverError(
    res,
    config.isProd ? 'Une erreur interne est survenue' : err.message
  );
});

module.exports = app;
