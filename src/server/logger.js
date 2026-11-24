import pino from 'pino'
import { config } from './config.js'

export function createLogger(overrides = {}) {
  return pino({
    level: overrides.level ?? config.logLevel,
    redact: {
      paths: [
        'req.headers.cookie',
        'req.headers.authorization',
        'res.headers["set-cookie"]',
        'password',
        'passphrase',
        'token',
        'refreshToken',
        'accessToken',
        '*.password',
        '*.passphrase',
        '*.token',
      ],
      censor: '[REDACTED]',
    },
    base: {
      service: 'ys-journal-api',
      environment: config.nodeEnv,
      version: config.appVersion,
    },
  })
}
