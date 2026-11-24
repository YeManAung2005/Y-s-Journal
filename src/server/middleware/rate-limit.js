import { rateLimit } from 'express-rate-limit'
import { HttpError } from '../lib/http-error.js'
import { recordSecurityEvent } from '../services/security-service.js'

function limiter({ windowMs, limit, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    async handler(req, res, next) {
      await recordSecurityEvent({
        type: 'rate_limited',
        req,
        metadata: { method: req.method, path: req.originalUrl },
        logger: req.log,
      })
      next(new HttpError(429, 'RATE_LIMITED', message))
    },
  })
}

const passthrough = (req, res, next) => next()

export function createRateLimiters({ enabled = true } = {}) {
  if (!enabled) {
    return { login: passthrough, sensitive: passthrough, api: passthrough }
  }

  return {
    login: limiter({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      message: 'Too many sign-in attempts. Wait a few minutes and try again.',
    }),
    sensitive: limiter({
      windowMs: 15 * 60 * 1000,
      limit: 20,
      message: 'Too many security actions. Wait a few minutes and try again.',
    }),
    api: limiter({
      windowMs: 60 * 1000,
      limit: 600,
      message: 'Too many requests. Slow down and try again.',
    }),
  }
}
