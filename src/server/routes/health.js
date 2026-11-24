import { Router } from 'express'
import { config } from '../config.js'

export const healthRouter = Router()

healthRouter.get('/health', async (req, res) => {
  const mongoUp = await req.app.locals.pingMongo()
  const status = mongoUp ? 'ok' : 'degraded'
  const appConfig = req.app.locals.config ?? config

  res.status(mongoUp ? 200 : 503).json({
    data: {
      status,
      service: 'ys-journal-api',
      version: appConfig.appVersion,
      environment: appConfig.nodeEnv,
      mongo: mongoUp ? 'up' : 'down',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  })
})
