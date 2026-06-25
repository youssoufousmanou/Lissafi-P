'use strict';

/**
 * Planificateur de tâches cron — LISSAFI-P
 *
 * Jobs configurés :
 * - Toutes les heures    : Marquer les créances en retard (debt_status → LATE)
 * - Tous les jours 8h00  : Envoyer les rappels de charges fixes
 * - Tous les jours 9h00  : Envoyer les relances clients (créances échues)
 * - Tous les jours 0h00  : Expirer les abonnements Pro dépassés
 * - Toutes les 5 min     : Envoyer les SMS en file d'attente (status = PENDING)
 */

const cron   = require('node-cron');
const logger = require('../utils/logger');

// Les handlers seront implémentés dans leurs modules respectifs
// On importe en lazy pour éviter les dépendances circulaires au démarrage

const jobs = [];

function scheduleJob(cronExpr, name, fn) {
  const task = cron.schedule(cronExpr, async () => {
    logger.info(`[Cron] Démarrage du job : ${name}`);
    const start = Date.now();
    try {
      await fn();
      logger.info(`[Cron] Job terminé : ${name}`, { duréeMs: Date.now() - start });
    } catch (err) {
      logger.error(`[Cron] Erreur dans le job : ${name}`, { error: err.message });
    }
  }, {
    timezone: 'Africa/Douala',  // UTC+1 — heure de Maroua
  });

  jobs.push({ name, task });
  logger.info(`[Cron] Job planifié : ${name} (${cronExpr})`);
}

// ---------------------------------------------------------------------------
// Définition des jobs
// ---------------------------------------------------------------------------

// 1. Marquer les créances en retard (toutes les heures)
scheduleJob('0 * * * *', 'mark-overdue-debts', async () => {
  const { markOverdueDebts } = require('../modules/visits/visits.service');
  await markOverdueDebts();
});

// 2. Rappels de charges fixes (chaque jour à 8h00)
scheduleJob('0 8 * * *', 'charge-reminders', async () => {
  const { sendChargeReminders } = require('../modules/charges/charges.service');
  await sendChargeReminders();
});

// 3. Relances créances clients (chaque jour à 9h00)
scheduleJob('0 9 * * *', 'client-debt-reminders', async () => {
  const { sendDebtReminders } = require('../modules/visits/visits.service');
  await sendDebtReminders();
});

// 4. Expiration des abonnements Pro (chaque jour à minuit)
scheduleJob('0 0 * * *', 'expire-subscriptions', async () => {
  const { expireSubscriptions } = require('../modules/subscriptions/subscriptions.service');
  await expireSubscriptions();
});

// 5. Envoi des SMS en attente (toutes les 5 minutes)
scheduleJob('*/5 * * * *', 'flush-sms-queue', async () => {
  const { flushSmsQueue } = require('../utils/sms');
  await flushSmsQueue();
});

// ---------------------------------------------------------------------------
// Arrêt propre de tous les jobs
// ---------------------------------------------------------------------------
process.on('SIGTERM', () => {
  jobs.forEach(({ name, task }) => {
    task.stop();
    logger.info(`[Cron] Job arrêté : ${name}`);
  });
});

module.exports = { jobs };
