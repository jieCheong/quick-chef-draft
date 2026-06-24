// server/src/logger.ts
//
// One Pino instance, created once, imported everywhere that needs to log.
// Every route file replaces console.error/console.log with this logger.
//
// WHY ONE SHARED INSTANCE INSTEAD OF require('pino')() IN EVERY FILE:
// Pino instances carry configuration (redaction rules, formatting,
// log level). Creating a new instance per file means that config has
// to be duplicated and could drift out of sync between files. A single
// exported instance guarantees every log line in the app — auth, pantry,
// generate, wherever — obeys the exact same redaction and formatting rules.

import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  // 'info' is the default level for normal operation logs (requests,
  // successful actions). 'error' for failures. Pino's level hierarchy:
  // trace < debug < info < warn < error < fatal. Setting the level to
  // 'info' in production means trace/debug lines are silently dropped —
  // cheap to leave debug() calls in code without flooding production logs.
  level: process.env.LOG_LEVEL || 'info',

  // pino-pretty is a separate transport that formats JSON into readable
  // colored lines FOR LOCAL DEVELOPMENT ONLY. In production, this
  // transport is omitted entirely so Pino emits raw JSON — Railway's
  // log viewer (and most log aggregators) expect raw JSON lines and
  // parse them into filterable fields automatically. Pretty-printing
  // in production would defeat the entire purpose of structured logging.
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },

  // redact strips these field paths from EVERY log object before it's
  // written anywhere, even if a developer accidentally logs an entire
  // req.body that happens to contain a password. This is a hard safety
  // net — it doesn't rely on every individual log call remembering not
  // to include sensitive fields.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.body.password',
      'req.body.password_hash',
      'password',
      'password_hash',
      'token',
      '*.password',
      '*.password_hash',
      '*.token',
    ],
    censor: '[REDACTED]',
  },
});