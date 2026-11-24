import path from 'node:path'
import { fileURLToPath } from 'node:url'
import packageJson from '../../package.json' with { type: 'json' }

const rootDir = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))

function parsePort(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    return fallback
  }
  return parsed
}

export const config = Object.freeze({
  appName: "Y's Journal",
  appVersion: packageJson.version,
  nodeEnv: process.env.NODE_ENV || 'development',
  host: process.env.HOST || '127.0.0.1',
  port: parsePort(process.env.PORT, 4000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ys_journal',
  logLevel: process.env.LOG_LEVEL || 'info',
  rootDir,
  clientDistDir: path.join(rootDir, 'dist', 'client'),
})
