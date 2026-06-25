'use strict';

/**
 * Service Auth — LISSAFI-P
 *
 * Contient toute la logique métier de l'authentification :
 * inscription, vérification OTP, connexion, refresh token, logout, profil.
 *
 * Ce service ne touche jamais req/res — il ne connaît pas Express.
 * Il communique uniquement avec la DB, Redis, et les utilitaires.
 */

const bcrypt       = require('bcryptjs');
const db           = require('../../config/db');
const cache        = require('../../config/redis');
const config       = require('../../config/env');
const logger       = require('../../utils/logger');
const { generateOtp, sendOtpSms } = require('../../utils/otp');
const { generateTokens, verifyRefreshToken, hashToken } = require('../../utils/jwt');

// ---------------------------------------------------------------------------
// INSCRIPTION
// ---------------------------------------------------------------------------

/**
 * Démarre une inscription et envoie un OTP de vérification.
 * Le compte utilisateur n'est créé qu'après validation du code OTP.
 *
 * @param {Object} data
 * @param {string} [data.phone]
 * @param {string} [data.email]
 * @param {string} [data.activity_type]
 * @param {string} [data.boutique_name]
 * @returns {Promise<{ identifier: string }>}
 * @throws Si le téléphone/email est déjà utilisé
 */
async function register(data) {
  const { phone, email, activity_type = 'COMMERCE_GENERAL', boutique_name } = data;
  const identifier = phone || email;

  // Vérifier unicité du téléphone ou de l'email
  if (phone) {
    const existing = await db.query(
      'SELECT id FROM users WHERE phone = $1',
      [phone]
    );
    if (existing.rowCount > 0) {
      const err = new Error('Ce numéro de téléphone est déjà associé à un compte');
      err.statusCode = 409;
      throw err;
    }
  }

  if (email) {
    const existing = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    if (existing.rowCount > 0) {
      const err = new Error('Cette adresse e-mail est déjà associée à un compte');
      err.statusCode = 409;
      throw err;
    }
  }

  await createAndSendPendingRegistrationOtp({
    identifier,
    phone: phone || null,
    email: email || null,
    activity_type,
    boutique_name: boutique_name || null,
  });

  logger.info('[Auth] Inscription en attente — OTP envoyé', { identifier });
  return { identifier };
}

// ---------------------------------------------------------------------------
// VÉRIFICATION OTP
// ---------------------------------------------------------------------------

/**
 * Vérifie le code OTP soumis par l'utilisateur.
 * Si valide, active le compte et demande la création du mot de passe.
 *
 * @param {string} identifier - Téléphone ou email
 * @param {string} token      - Code OTP à 6 chiffres
 * @returns {Promise<{ userId: string, requiresPassword: boolean }>}
 */
async function verifyOtp(identifier, token) {
  const pendingRegistration = await getPendingRegistration(identifier);

  if (pendingRegistration) {
    return verifyPendingRegistrationOtp(identifier, token, pendingRegistration);
  }

  // Récupérer l'OTP le plus récent non utilisé pour cet identifiant
  const { rows } = await db.query(
    `SELECT o.id, o.user_id, o.expires_at, o.attempts, u.password_hash
     FROM otp_tokens o
     JOIN users u ON u.id = o.user_id
     WHERE o.identifier = $1
       AND o.token      = $2
       AND o.is_used    = FALSE
     ORDER BY o.created_at DESC
     LIMIT 1`,
    [identifier, token]
  );

  if (rows.length === 0) {
    const err = new Error('Code OTP invalide ou déjà utilisé');
    err.statusCode = 400;
    throw err;
  }

  const otp = rows[0];

  // Vérifier expiration (10 minutes — règle métier CDC M1)
  if (new Date() > new Date(otp.expires_at)) {
    const err = new Error(`Le code OTP a expiré. Demandez-en un nouveau.`);
    err.statusCode = 400;
    throw err;
  }

  // Marquer l'OTP comme utilisé + activer le compte (transaction atomique)
  await db.transaction(async (client) => {
    await client.query(
      'UPDATE otp_tokens SET is_used = TRUE WHERE id = $1',
      [otp.id]
    );
    await client.query(
      'UPDATE users SET is_verified = TRUE WHERE id = $1',
      [otp.user_id]
    );
  });

  const requiresPassword = otp.password_hash === 'PENDING';

  logger.info('[Auth] OTP vérifié avec succès', {
    userId: otp.user_id,
    requiresPassword,
  });

  return { userId: otp.user_id, requiresPassword };
}

// ---------------------------------------------------------------------------
// CRÉATION DU MOT DE PASSE (après vérification OTP)
// ---------------------------------------------------------------------------

/**
 * Définit le mot de passe d'un utilisateur vérifié.
 * Appelé juste après verifyOtp quand requiresPassword = true.
 *
 * @param {string} userId
 * @param {string} password - 4 chiffres (validé par le validator)
 * @returns {Promise<{ accessToken: string, refreshToken: string, user: Object }>}
 */
async function setPassword(userId, password) {

  const { rows } = await db.query(
    'SELECT is_verified, password_hash FROM users WHERE id = $1',
    [userId]
  );
  if (!rows[0] || !rows[0].is_verified) throw Object.assign(new Error('OTP non vérifié'), { statusCode: 403 });
  if (rows[0].password_hash !== 'PENDING') throw Object.assign(new Error('Mot de passe déjà défini'), { statusCode: 409 });

  const hash = await bcrypt.hash(password, config.security.bcryptRounds);

  await db.query(
    'UPDATE users SET password_hash = $1 WHERE id = $2',
    [hash, userId]
  );

  // Connexion automatique après création du mot de passe
  const user = await getUserById(userId);
  const tokens = await createSession(user);

  logger.info('[Auth] Mot de passe défini — session créée', { userId });
  return { ...tokens, user };
}

// ---------------------------------------------------------------------------
// CONNEXION
// ---------------------------------------------------------------------------

/**
 * Authentifie un utilisateur avec son identifiant et mot de passe.
 *
 * @param {string} identifier - Téléphone ou email
 * @param {string} password   - 4 chiffres
 * @returns {Promise<{ accessToken: string, refreshToken: string, user: Object }>}
 */
async function login(identifier, password) {
  // Trouver l'utilisateur par téléphone ou email
  const { rows } = await db.query(
    `SELECT id, phone, email, password_hash, plan, is_verified, is_active,
            activity_type, boutique_name, logo_url
     FROM users
     WHERE phone = $1 OR email = $1
     LIMIT 1`,
    [identifier]
  );

  if (rows.length === 0) {
    const err = new Error('Identifiant ou mot de passe incorrect');
    err.statusCode = 401;
    throw err;
  }

  const user = rows[0];

  // Vérifier que le compte est actif
  if (!user.is_active) {
    const err = new Error('Ce compte a été désactivé. Contactez le support.');
    err.statusCode = 403;
    throw err;
  }

  // Vérifier que l'OTP a été validé
  if (!user.is_verified) {
    const err = new Error('Compte non vérifié. Veuillez d\'abord valider votre code OTP.');
    err.statusCode = 403;
    throw err;
  }

  // Vérifier le mot de passe
  if (user.password_hash === 'PENDING') {
    const err = new Error('Mot de passe non défini. Veuillez compléter votre inscription.');
    err.statusCode = 400;
    throw err;
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    const err = new Error('Identifiant ou mot de passe incorrect');
    err.statusCode = 401;
    throw err;
  }

  // Mettre à jour last_login_at
  await db.query(
    'UPDATE users SET last_login_at = NOW() WHERE id = $1',
    [user.id]
  );

  const tokens = await createSession(user);

  logger.info('[Auth] Connexion réussie', { userId: user.id });
  return {
    ...tokens,
    user: sanitizeUser(user),
  };
}

// ---------------------------------------------------------------------------
// RENOUVELLEMENT DU TOKEN
// ---------------------------------------------------------------------------

/**
 * Émet un nouvel access token à partir d'un refresh token valide.
 *
 * @param {string} refreshToken - Le refresh token brut
 * @returns {Promise<{ accessToken: string }>}
 */
async function refreshAccessToken(refreshToken) {
  // Vérifier la signature JWT
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    const err = new Error('Refresh token invalide ou expiré');
    err.statusCode = 401;
    throw err;
  }

  const tokenHash = hashToken(refreshToken);

  // Vérifier que le token existe en base et n'est pas révoqué
  const { rows } = await db.query(
    `SELECT rt.id, u.id AS user_id, u.plan, u.is_active
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1
       AND rt.is_revoked  = FALSE
       AND rt.expires_at  > NOW()`,
    [tokenHash]
  );

  if (rows.length === 0) {
    const err = new Error('Session expirée. Veuillez vous reconnecter.');
    err.statusCode = 401;
    throw err;
  }

  const session = rows[0];

  if (!session.is_active) {
    const err = new Error('Ce compte a été désactivé.');
    err.statusCode = 403;
    throw err;
  }

  // Générer un nouvel access token
  const { accessToken } = generateTokens({
    userId: session.user_id,
    plan:   session.plan,
  });

  logger.debug('[Auth] Access token renouvelé', { userId: session.user_id });
  return { accessToken };
}

// ---------------------------------------------------------------------------
// DÉCONNEXION
// ---------------------------------------------------------------------------

/**
 * Révoque le refresh token de la session courante.
 *
 * @param {string} userId
 * @param {string} refreshToken - Token brut envoyé par le client
 * @returns {Promise<void>}
 */
async function logout(userId, refreshToken) {
  const tokenHash = hashToken(refreshToken);

  await db.query(
    `UPDATE refresh_tokens
     SET is_revoked = TRUE
     WHERE user_id    = $1
       AND token_hash = $2`,
    [userId, tokenHash]
  );

  logger.info('[Auth] Déconnexion réussie', { userId });
}

// ---------------------------------------------------------------------------
// PROFIL UTILISATEUR
// ---------------------------------------------------------------------------

/**
 * Retourne le profil complet de l'utilisateur connecté (sans password_hash).
 *
 * @param {string} userId
 * @returns {Promise<Object>}
 */
async function getProfile(userId) {
  const user = await getUserById(userId);
  if (!user) {
    const err = new Error('Utilisateur introuvable');
    err.statusCode = 404;
    throw err;
  }
  return sanitizeUser(user);
}

// ---------------------------------------------------------------------------
// MISE À JOUR DU PROFIL
// ---------------------------------------------------------------------------

/**
 * Met à jour les informations du profil utilisateur.
 *
 * @param {string} userId
 * @param {Object} data - Champs à mettre à jour (tous optionnels)
 * @returns {Promise<Object>} Profil mis à jour
 */
async function updateProfile(userId, data) {
  const fields = [];
  const values = [];
  let   idx    = 1;

  const allowed = [
    'boutique_name', 'address', 'description',
    'activity_type', 'work_hours_start', 'work_hours_end',
  ];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = $${idx}`);
      values.push(data[key]);
      idx++;
    }
  }

  if (fields.length === 0) {
    const err = new Error('Aucun champ valide à mettre à jour');
    err.statusCode = 400;
    throw err;
  }

  values.push(userId);
  const { rows } = await db.query(
    `UPDATE users SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $${idx}
     RETURNING id, phone, email, activity_type, boutique_name, address,
               description, logo_url, plan, work_hours_start, work_hours_end`,
    values
  );

  logger.info('[Auth] Profil mis à jour', { userId, fields: Object.keys(data) });
  return rows[0];
}

// ---------------------------------------------------------------------------
// CHANGEMENT DE MOT DE PASSE
// ---------------------------------------------------------------------------

/**
 * Change le mot de passe après vérification de l'ancien.
 *
 * @param {string} userId
 * @param {string} currentPassword
 * @param {string} newPassword
 * @returns {Promise<void>}
 */
async function changePassword(userId, currentPassword, newPassword) {
  const { rows } = await db.query(
    'SELECT password_hash FROM users WHERE id = $1',
    [userId]
  );

  if (rows.length === 0) {
    const err = new Error('Utilisateur introuvable');
    err.statusCode = 404;
    throw err;
  }

  const match = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!match) {
    const err = new Error('Mot de passe actuel incorrect');
    err.statusCode = 401;
    throw err;
  }

  const newHash = await bcrypt.hash(newPassword, config.security.bcryptRounds);
  await db.query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [newHash, userId]
  );

  // Révoquer TOUS les refresh tokens de cet utilisateur (sécurité)
  await db.query(
    'UPDATE refresh_tokens SET is_revoked = TRUE WHERE user_id = $1',
    [userId]
  );

  logger.info('[Auth] Mot de passe modifié — sessions révoquées', { userId });
}

// ---------------------------------------------------------------------------
// RENVOYER UN OTP
// ---------------------------------------------------------------------------

/**
 * Génère et renvoie un nouveau code OTP à l'identifiant donné.
 *
 * @param {string} identifier - Téléphone ou email
 * @returns {Promise<void>}
 */
async function resendOtp(identifier) {
  const pendingRegistration = await getPendingRegistration(identifier);

  if (pendingRegistration) {
    await createAndSendPendingRegistrationOtp({
      identifier,
      phone: pendingRegistration.phone || null,
      email: pendingRegistration.email || null,
      activity_type: pendingRegistration.activity_type,
      boutique_name: pendingRegistration.boutique_name || null,
    });
    logger.info('[Auth] OTP de pré-inscription renvoyé', { identifier });
    return;
  }

  const { rows } = await db.query(
    `SELECT id FROM users WHERE phone = $1 OR email = $1 LIMIT 1`,
    [identifier]
  );

  if (rows.length === 0) {
    // Sécurité : ne pas révéler si le compte existe
    logger.warn('[Auth] Renvoi OTP demandé pour identifiant inexistant', { identifier });
    return;
  }

  const userId  = rows[0].id;
  const channel = identifier.includes('@') ? 'email' : 'sms';

  await createAndSendOtp(userId, identifier, channel);
  logger.info('[Auth] OTP renvoyé', { userId, identifier });
}

// ---------------------------------------------------------------------------
// Helpers privés
// ---------------------------------------------------------------------------

/**
 * Retourne le TTL Redis utilisé pour garder une inscription en attente.
 */
function getPendingRegistrationTtlSec() {
  return config.otp.expiresMinutes * 60;
}

/**
 * Récupère une inscription en attente depuis Redis.
 */
async function getPendingRegistration(identifier) {
  return cache.get(cache.KEYS.pendingRegistration(identifier));
}

/**
 * Crée un OTP temporaire pour une inscription qui n'existe pas encore en DB.
 */
async function createAndSendPendingRegistrationOtp(registration) {
  const otp = generateOtp();
  const channel = registration.phone ? 'sms' : 'email';

  await cache.set(
    cache.KEYS.pendingRegistration(registration.identifier),
    { ...registration, token: otp },
    getPendingRegistrationTtlSec()
  );

  let smsMeta = {};
  if (channel === 'sms') {
    smsMeta = await sendOtpSms(registration.identifier, otp);
  } else {
    logger.info('[Auth] OTP email (non encore implémenté)', {
      identifier: registration.identifier,
      otp,
    });
  }

  return config.sms.bypass ? { otpBypass: smsMeta.otp } : {};
}

/**
 * Vérifie un OTP de pré-inscription et crée le compte seulement après succès.
 */
async function verifyPendingRegistrationOtp(identifier, token, pendingRegistration) {
  if (pendingRegistration.token !== token) {
    const err = new Error('Code OTP invalide ou déjà utilisé');
    err.statusCode = 400;
    throw err;
  }

  const { phone, email, activity_type, boutique_name } = pendingRegistration;

  const result = await db.transaction(async (client) => {
    if (phone) {
      const existing = await client.query(
        'SELECT id FROM users WHERE phone = $1',
        [phone]
      );
      if (existing.rowCount > 0) {
        const err = new Error('Ce numéro de téléphone est déjà associé à un compte');
        err.statusCode = 409;
        throw err;
      }
    }

    if (email) {
      const existing = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );
      if (existing.rowCount > 0) {
        const err = new Error('Cette adresse e-mail est déjà associée à un compte');
        err.statusCode = 409;
        throw err;
      }
    }

    const { rows } = await client.query(
      `INSERT INTO users (phone, email, activity_type, boutique_name, password_hash, is_verified)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING id`,
      [
        phone || null,
        email || null,
        activity_type || 'COMMERCE_GENERAL',
        boutique_name || null,
        'PENDING',
      ]
    );

    return { userId: rows[0].id, requiresPassword: true };
  });

  await cache.del(cache.KEYS.pendingRegistration(identifier));

  logger.info('[Auth] OTP pré-inscription vérifié — compte créé', {
    userId: result.userId,
    identifier,
  });

  return result;
}

/**
 * Crée un OTP en base et l'envoie par SMS ou email.
 */
async function createAndSendOtp(userId, identifier, channel = 'sms') {
  const otp     = generateOtp();
  const expires = new Date(Date.now() + config.otp.expiresMinutes * 60 * 1000);

  await db.query(
    `UPDATE otp_tokens SET is_used = TRUE WHERE identifier = $1 AND is_used = FALSE`,
    [identifier]
  );
  await db.query(
    `INSERT INTO otp_tokens (user_id, identifier, token, expires_at) VALUES ($1, $2, $3, $4)`,
    [userId, identifier, otp, expires]
  );

  let smsMeta = {};
  if (channel === 'sms') {
    smsMeta = await sendOtpSms(identifier, otp);
  } else {
    logger.info('[Auth] OTP email (non encore implémenté)', { identifier, otp });
  }

  // Retourne l'OTP si bypass activé — le controller le transmettra au client
  return config.sms.bypass ? { otpBypass: smsMeta.otp } : {};
}

/**
 * Crée une session : génère les tokens et les stocke en base.
 */
async function createSession(user, deviceInfo = null, ipAddress = null) {
  const { accessToken, refreshToken, refreshTokenHash } = generateTokens({
    userId: user.id,
    plan:   user.plan,
  });

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 jours

  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, device_info, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [user.id, refreshTokenHash, deviceInfo, ipAddress, expiresAt]
  );

  return { accessToken, refreshToken };
}

/**
 * Récupère un utilisateur par son ID.
 */
async function getUserById(userId) {
  const { rows } = await db.query(
    `SELECT id, phone, email, activity_type, boutique_name, address,
            description, logo_url, plan, is_verified, is_active,
            work_hours_start, work_hours_end, last_login_at, created_at
     FROM users WHERE id = $1`,
    [userId]
  );
  return rows[0] || null;
}

/**
 * Retire les champs sensibles d'un objet user avant de l'envoyer au client.
 */
function sanitizeUser(user) {
  const { password_hash, ...safe } = user;
  return safe;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  register,
  verifyOtp,
  setPassword,
  login,
  refreshAccessToken,
  logout,
  getProfile,
  updateProfile,
  changePassword,
  resendOtp,
};
