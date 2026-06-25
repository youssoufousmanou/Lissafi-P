'use strict';

/**
 * Logger centralisé via Winston.
 *
 * - En développement : format colorisé dans la console
 * - En production    : JSON structuré + rotation de fichiers journaliers
 *
 * Niveaux : error > warn > info > debug
 */

const { createLogger, format, transports } = require('winston');
require('winston-daily-rotate-file');

const config = require('../config/env');
const { combine, timestamp, json, colorize, printf, errors } = format;

// ---------------------------------------------------------------------------
// Format console (développement)
// ---------------------------------------------------------------------------

const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${ts}] ${level}: ${message}${metaStr}`;
  })
);

// ---------------------------------------------------------------------------
// Format production (JSON structuré — compatible avec Sentry, Datadog, etc.)
// ---------------------------------------------------------------------------

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

// ---------------------------------------------------------------------------
// Transports
// ---------------------------------------------------------------------------

const loggerTransports = [];

if (config.isDev || config.isTest) {
  loggerTransports.push(new transports.Console({ format: devFormat }));
} else {
  // Console JSON en production (stdout capturé par Railway/Render)
  loggerTransports.push(new transports.Console({ format: prodFormat }));

  // Rotation journalière — garde 14 jours de logs
  loggerTransports.push(new transports.DailyRotateFile({
    filename:    `${config.logging.dir}/lissafi-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize:     '20m',
    maxFiles:    '14d',
    format:      prodFormat,
  }));

  // Fichier dédié aux erreurs
  loggerTransports.push(new transports.DailyRotateFile({
    filename:    `${config.logging.dir}/lissafi-error-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    level:       'error',
    zippedArchive: true,
    maxSize:     '10m',
    maxFiles:    '30d',
    format:      prodFormat,
  }));
}

// ---------------------------------------------------------------------------
// Instance
// ---------------------------------------------------------------------------

const logger = createLogger({
  level:      config.logging.level,
  transports: loggerTransports,
  // Ne pas faire crash le process sur une erreur de logger
  exitOnError: false,
});

module.exports = logger;
