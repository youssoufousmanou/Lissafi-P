'use strict';

/**
 * Utilitaire OTP — LISSAFI-P
 *
 * Génère des codes OTP à 6 chiffres et les envoie par SMS.
 * En développement : affiche le code dans les logs (pas de vrai SMS).
 * En production    : envoie via Twilio ou Orange API Cameroun.
 */

const crypto = require('crypto');
const config = require('../config/env');
const logger = require('./logger');

// ---------------------------------------------------------------------------
// Générer un code OTP
// ---------------------------------------------------------------------------

/**
 * Génère un code OTP à 6 chiffres cryptographiquement sécurisé.
 * Utilise crypto.randomInt pour éviter les biais statistiques.
 *
 * @returns {string} Code OTP à 6 chiffres (ex: "047823")
 */
function generateOtp() {
  const code = crypto.randomInt(0, 999999);
  return code.toString().padStart(6, '0');
}

// ---------------------------------------------------------------------------
// Envoyer le code OTP par SMS
// ---------------------------------------------------------------------------

/**
 * Envoie un SMS contenant le code OTP au numéro donné.
 * Bascule automatiquement sur le mock en environnement de test/dev.
 *
 * @param {string} phone   - Numéro de téléphone au format international (+237...)
 * @param {string} otp     - Code OTP à 6 chiffres
 * @returns {Promise<{ success: boolean, provider: string, ref?: string }>}
 */
async function sendOtpSms(phone, otp) {
  const message = `[LISSAFI-P] Votre code de vérification est : ${otp}. Valable ${config.otp.expiresMinutes} minutes. Ne le partagez jamais.`;

  // Dev/test : mock
  if (config.isDev || config.isTest) {
    logger.info('[OTP] MODE DEV — Code OTP généré (pas de SMS envoyé)', { phone, otp });
    return { success: true, provider: 'mock', ref: 'dev-' + Date.now() };
  }

  // Bypass SMS : retourne l'OTP dans la réponse (staging uniquement)
  if (config.sms.bypass) {
    logger.warn('[OTP] SMS_BYPASS activé — OTP retourné en clair (désactiver en prod réelle)', { phone, otp });
    return { success: true, provider: 'bypass', otp }; // ← otp exposé ici
  }

  // Production : Twilio
  try {
    return await sendViaTwilio(phone, message);
  } catch (twilioErr) {
    logger.error('[OTP] Twilio échoué — détail complet', {
      message:  twilioErr.message,
      code:     twilioErr.code,
      status:   twilioErr.status,
      moreInfo: twilioErr.moreInfo,
    });
    const err = new Error('Service SMS indisponible. Réessayez dans quelques instants.');
    err.statusCode = 503;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Provider Twilio
// ---------------------------------------------------------------------------

async function sendViaTwilio(phone, message) {
  // Validation des secrets Twilio : évite des erreurs brutes/500 si une variable est manquante.
  if (!config.twilio.accountSid || !config.twilio.authToken || !config.twilio.phoneNumber) {
    const err = new Error('Twilio non configuré. Vérifiez TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER.');
    err.statusCode = 503;
    throw err;
  }

  const twilio = require('twilio')(
    config.twilio.accountSid,
    config.twilio.authToken
  );

  const response = await twilio.messages.create({
    body: message,
    from: config.twilio.phoneNumber,
    to:   phone,
  });

  logger.info('[OTP] SMS envoyé via Twilio', { sid: response.sid, phone });
  return { success: true, provider: 'twilio', ref: response.sid };
}


// ---------------------------------------------------------------------------
// Provider Orange Money Cameroun
// ---------------------------------------------------------------------------

async function sendViaOrange(phone, message) {
  // TODO: intégrer l'API SMS d'Orange Cameroun
  // Documentation : https://developer.orange.com/apis/sms-cm/overview
  logger.warn('[OTP] Orange API SMS non encore implémentée');
  const err = new Error('Orange API SMS non implémentée');
  err.statusCode = 503;
  throw err;
}

// ---------------------------------------------------------------------------
// Construire le message OTP
// ---------------------------------------------------------------------------

/**
 * Retourne le texte du message OTP formaté.
 * Utile pour l'envoyer aussi par e-mail si l'utilisateur n'a pas de téléphone.
 *
 * @param {string} otp
 * @returns {string}
 */
function buildOtpMessage(otp) {
  return `Votre code de vérification LISSAFI-P est : ${otp}\n\nCe code est valable ${config.otp.expiresMinutes} minutes.\nNe le partagez jamais avec quiconque.`;
}

module.exports = {
  generateOtp,
  sendOtpSms,
  buildOtpMessage,
};
