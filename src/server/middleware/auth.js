import { HttpError } from '../lib/http-error.js'
import { clearSessionCookie, readSessionCookie } from '../lib/cookies.js'
import { recordSecurityEvent } from '../services/security-service.js'
import { validateSession } from '../services/session-service.js'

export async function requireAuth(req, res, next) {
  const config = req.app.locals.config
  const token = readSessionCookie(req, config)

  if (!token) {
    return next(new HttpError(401, 'AUTH_REQUIRED', 'Authentication is required.'))
  }

  const result = await validateSession(token)

  if (!result) {
    clearSessionCookie(res, config)
    return next(new HttpError(401, 'AUTH_REQUIRED', 'Authentication is required.'))
  }

  if (result.expired) {
    await recordSecurityEvent({
      type: 'session_expired',
      userId: result.session?.userId ?? null,
      req,
      logger: req.log,
    })
    clearSessionCookie(res, config)
    return next(new HttpError(401, 'SESSION_EXPIRED', 'Your session expired. Sign in again.'))
  }

  req.user = result.user
  req.session = result.session
  return next()
}
