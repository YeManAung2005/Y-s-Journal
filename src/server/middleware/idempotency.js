import { HttpError } from '../lib/http-error.js'
import { readSessionCookie } from '../lib/cookies.js'
import { validateSession } from '../services/session-service.js'
import {
  beginSyncOperation,
  completeSyncOperation,
  failSyncOperation,
  findSyncOperation,
} from '../services/sync-service.js'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const SKIP_PREFIXES = [
  '/api/v1/auth',
  '/api/v1/onboarding',
  '/api/v1/settings',
  '/api/v1/security',
  '/api/v1/health',
]
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,120}$/

function shouldSkip(req) {
  if (SAFE_METHODS.has(req.method)) return true
  if (SKIP_PREFIXES.some((prefix) => req.path.startsWith(prefix))) return true
  return !req.get('idempotency-key')
}

async function resolveUser(req) {
  const config = req.app.locals.config
  const token = readSessionCookie(req, config)
  if (!token) return null

  const result = await validateSession(token)
  if (!result || result.expired) return null
  return result.user
}

export async function idempotency(req, res, next) {
  if (shouldSkip(req)) return next()

  const key = req.get('idempotency-key')
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    return next(new HttpError(400, 'VALIDATION_ERROR', 'The idempotency key is invalid.'))
  }

  const user = await resolveUser(req)
  if (!user) return next()

  const path = req.originalUrl.split('?')[0]
  const replay = (operation) => {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('x-ysj-replayed', 'true')
    return res.status(operation.statusCode ?? 200).json(operation.response ?? null)
  }

  const inProgress = () =>
    next(new HttpError(409, 'SYNC_IN_PROGRESS', 'This change is still being synchronized.'))

  const existing = await findSyncOperation(user.id, key)

  if (existing?.status === 'completed') return replay(existing)
  if (existing?.status === 'pending') return inProgress()

  const operation = await beginSyncOperation(user.id, key, req.method, path)
  if (operation?.status === 'completed') return replay(operation)
  if (operation?.status === 'pending') return inProgress()

  let captured = null
  let finalized = false
  const originalJson = res.json.bind(res)

  res.json = (body) => {
    captured = { statusCode: res.statusCode, body }
    return originalJson(body)
  }

  const finalize = async () => {
    if (finalized) return
    finalized = true

    if (!captured) {
      await failSyncOperation(user.id, key, null)
      return
    }

    if (captured.statusCode >= 200 && captured.statusCode < 300) {
      await completeSyncOperation(user.id, key, captured.statusCode, captured.body)
    } else {
      await failSyncOperation(user.id, key, null)
    }
  }

  res.once('finish', () => void finalize())
  res.once('close', () => void finalize())

  return next()
}
