import { csrfCookieName, csrfCookieOptions, createCsrfToken } from '../lib/cookies.js'
import { HttpError } from '../lib/http-error.js'
import { safeEqual } from '../lib/tokens.js'
import { recordSecurityEvent } from '../services/security-service.js'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function csrfTokenHandler(req, res) {
  const config = req.app.locals.config
  const cookieName = csrfCookieName(config)
  const existing = req.cookies?.[cookieName]
  const token = existing || createCsrfToken()

  if (!existing) {
    res.cookie(cookieName, token, csrfCookieOptions(config))
  }

  res.setHeader('Cache-Control', 'no-store')
  res.json({ data: { csrfToken: token } })
}

export async function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next()

  const config = req.app.locals.config
  const expected = req.cookies?.[csrfCookieName(config)]
  const provided = req.get('x-csrf-token')
  const origin = req.get('origin')

  let originAllowed = true
  if (origin) {
    try {
      originAllowed = new URL(origin).host === req.get('host')
    } catch {
      originAllowed = false
    }
  }

  if (!originAllowed || !expected || !provided || !safeEqual(expected, provided)) {
    await recordSecurityEvent({
      type: 'csrf_rejected',
      req,
      metadata: { method: req.method, path: req.originalUrl },
      logger: req.log,
    })
    return next(
      new HttpError(
        403,
        'CSRF_INVALID',
        'The request could not be verified. Reload and try again.',
      ),
    )
  }

  return next()
}
