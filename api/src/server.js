'use strict';

/**
 * Point d'entrée du serveur LISSAFI-P.
 *
 * Responsabilités :
 * 1. Connecter Redis au démarrage
 * 2. Démarrer les jobs cron
 * 3. Lancer le serveur HTTP Express
 * 4. Gérer l'arrêt gracieux (SIGTERM / SIGINT)
 *    → Finir les requêtes en cours, fermer DB et Redis proprement
 */

const app    = require('./app');
const config = require('./config/env');
const logger = require('./utils/logger');
const db     = require('./config/db');
const cache  = require('./config/redis');

// ---------------------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------------------

async function start() {
  try {
    // 1. Vérifier la connexion à la base de données
    logger.info('[Server] Vérification de la connexion PostgreSQL...');
    await db.healthCheck();
    logger.info('[Server] PostgreSQL ✓');

    // 2. Connecter Redis (lazyConnect = true, on force ici)
    logger.info('[Server] Connexion à Redis...');
    await cache.redis.connect();
    logger.info('[Server] Redis ✓');

    // 3. Démarrer les jobs cron (relances, expiration subscriptions, etc.)
    require('./jobs/scheduler');
    logger.info('[Server] Jobs cron démarrés ✓');

    // 4. Lancer le serveur HTTP
    const server = app.listen(config.server.port, () => {
      logger.info(`[Server] LISSAFI-P API démarrée`, {
        port:    config.server.port,
        env:     config.env,
        version: config.server.apiVersion,
        url:     `http://localhost:${config.server.port}/api/${config.server.apiVersion}`,
      });
    });

    // 5. Configurer les timeouts serveur (important pour les uploads et les PDF)
    server.keepAliveTimeout  = 65_000; // > load balancer timeout (60s)
    server.headersTimeout    = 66_000;

    // 6. Arrêt gracieux
    setupGracefulShutdown(server);

  } catch (err) {
    logger.error('[Server] Impossible de démarrer', { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Arrêt gracieux
// ---------------------------------------------------------------------------

function setupGracefulShutdown(server) {
  const shutdown = async (signal) => {
    logger.info(`[Server] Signal ${signal} reçu — arrêt gracieux en cours...`);

    // 1. Arrêter d'accepter de nouvelles connexions
    server.close(async () => {
      logger.info('[Server] Serveur HTTP fermé');

      try {
        // 2. Fermer Redis proprement
        await cache.close();

        // 3. Fermer le pool PostgreSQL
        await db.close();

        logger.info('[Server] Arrêt propre effectué ✓');
        process.exit(0);
      } catch (err) {
        logger.error('[Server] Erreur lors de l\'arrêt', { error: err.message });
        process.exit(1);
      }
    });

    // Forcer l'arrêt si les connexions ne se ferment pas en 10s
    setTimeout(() => {
      logger.warn('[Server] Forçage de l\'arrêt après timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM')); // Kubernetes, Railway, Render
  process.on('SIGINT',  () => shutdown('SIGINT'));  // Ctrl+C en développement

  // Capture des erreurs non gérées pour éviter les crashs silencieux
  process.on('uncaughtException', (err) => {
    logger.error('[Server] Exception non capturée', { error: err.message, stack: err.stack });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('[Server] Promise rejetée non gérée', { reason: String(reason) });
    process.exit(1);
  });
}

// ---------------------------------------------------------------------------
// Lancement
// ---------------------------------------------------------------------------

start();
