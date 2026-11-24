import { existsSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import express from 'express'
import helmet from 'helmet'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import { pinoHttp } from 'pino-http'
import { config as defaultConfig } from './config.js'
import { createLogger } from './logger.js'
import { healthRouter } from './routes/health.js'
import { authRouter } from './routes/auth.js'
import { onboardingRouter } from './routes/onboarding.js'
import { settingsRouter } from './routes/settings.js'
import { securityRouter } from './routes/security.js'
import { csrfProtection } from './middleware/csrf.js'
import { createRateLimiters } from './middleware/rate-limit.js'
import { notFound } from './middleware/not-found.js'
import { errorHandler } from './middleware/error-handler.js'

export function createApp({
  pingMongo = async () => false,
  logger = createLogger(),
  config = defaultConfig,
  rateLimitEnabled = true,
} = {}) {
  const app = express()

  app.disable('x-powered-by')
  app.set('trust proxy', false)

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          ...(config.nodeEnv === 'production' ? { upgradeInsecureRequests: [] } : {}),
        },
      },
      strictTransportSecurity:
        config.nodeEnv === 'production' ? { maxAge: 31536000, includeSubDomains: false } : false,
      referrerPolicy: { policy: 'no-referrer' },
    }),
  )

  app.use(compression())
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: false, limit: '1mb' }))
  app.use(cookieParser())

  app.use(
    pinoHttp({
      logger,
      genReqId(req, res) {
        const requestId = req.headers['x-request-id'] || randomUUID()
        res.setHeader('x-request-id', requestId)
        return requestId
      },
      autoLogging: {
        ignore: (req) => req.url === '/api/v1/health',
      },
      serializers: {
        req(req) {
          return {
            id: req.id,
            method: req.method,
            url: req.url,
            remoteAddress: req.remoteAddress,
            remotePort: req.remotePort,
          }
        },
        res(res) {
          return {
            statusCode: res.statusCode,
          }
        },
      },
    }),
  )

  app.locals.pingMongo = pingMongo
  app.locals.config = config

  const rateLimiters = createRateLimiters({ enabled: rateLimitEnabled })

  app.use('/api/v1', healthRouter)
  app.use('/api/v1', rateLimiters.api)
  app.use('/api/v1/auth/login', rateLimiters.login)
  app.use('/api/v1/auth/unlock', rateLimiters.sensitive)
  app.use('/api/v1/auth/password', rateLimiters.sensitive)
  app.use('/api/v1/onboarding', rateLimiters.sensitive)
  app.use('/api/v1', csrfProtection)
  app.use('/api/v1', onboardingRouter)
  app.use('/api/v1', authRouter)
  app.use('/api/v1', settingsRouter)
  app.use('/api/v1', securityRouter)
  app.use('/api', notFound)

  if (config.nodeEnv === 'production') {
    const indexHtml = path.join(config.clientDistDir, 'index.html')

    if (existsSync(indexHtml)) {
      app.use(
        express.static(config.clientDistDir, {
          index: false,
          etag: true,
          maxAge: '1h',
          setHeaders(res, filePath) {
            if (filePath.endsWith('index.html')) {
              res.setHeader('Cache-Control', 'no-store')
            }
          },
        }),
      )

      app.use((req, res, next) => {
        if (req.method !== 'GET' || !req.accepts('html')) {
          return next()
        }
        res.setHeader('Cache-Control', 'no-store')
        return res.sendFile(indexHtml)
      })
    } else {
      logger.warn({ clientDistDir: config.clientDistDir }, 'Client build not found')
    }
  }

  app.use(notFound)
  app.use(errorHandler)

  return app
}
