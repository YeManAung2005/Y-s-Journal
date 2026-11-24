import { createServer } from 'node:http'
import { config } from './config.js'
import { createLogger } from './logger.js'
import { createApp } from './app.js'
import { connectMongo, disconnectMongo, pingMongo } from './db/mongo.js'

const logger = createLogger()
let mongoAvailable = false

try {
  await connectMongo(config.mongoUri, logger)
  mongoAvailable = true
  logger.info('MongoDB connected')
} catch (error) {
  logger.error({ err: error }, 'MongoDB connection failed; API will start in degraded mode')
}

const app = createApp({ pingMongo, logger, config })
const server = createServer(app)

server.listen(config.port, config.host, () => {
  logger.info(
    {
      host: config.host,
      port: config.port,
      environment: config.nodeEnv,
      mongo: mongoAvailable ? 'connected' : 'unavailable',
    },
    "Y's Journal API listening",
  )
})

let shuttingDown = false

async function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  logger.info({ signal }, 'Shutting down')

  await new Promise((resolve) => {
    server.close(() => resolve())
  })

  try {
    await disconnectMongo()
  } catch (error) {
    logger.warn({ err: error }, 'Error while disconnecting MongoDB')
  }

  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection')
})

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception')
  void shutdown('uncaughtException')
})
