import { Router } from 'express'
import { loginSchema, unlockSchema, changePasswordSchema } from '../../shared/validation/auth.js'
import { HttpError, parse } from '../lib/http-error.js'
import { clearSessionCookie, readSessionCookie, setSessionCookie } from '../lib/cookies.js'
import {
  login,
  changeOwnerPassword,
  serializeUser,
  verifyOwnerPassword,
} from '../services/auth-service.js'
import { recordSecurityEvent } from '../services/security-service.js'
import { findSessionByToken, revokeSession, serializeSession } from '../services/session-service.js'
import { requireAuth } from '../middleware/auth.js'
import { csrfTokenHandler } from '../middleware/csrf.js'

export const authRouter = Router()

authRouter.get('/auth/csrf', csrfTokenHandler)

authRouter.get('/auth/session', requireAuth, (req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  res.json({
    data: {
      user: serializeUser(req.user),
      session: serializeSession(req.session),
    },
  })
})

authRouter.post('/auth/login', async (req, res) => {
  const config = req.app.locals.config
  const credentials = parse(loginSchema, req.body ?? {})

  const existingToken = readSessionCookie(req, config)
  if (existingToken) {
    const existing = await findSessionByToken(existingToken)
    if (existing) await revokeSession(existing)
  }

  const { user, token } = await login({
    ...credentials,
    req,
    logger: req.log,
  })

  setSessionCookie(res, token, config)
  res.setHeader('Cache-Control', 'no-store')
  res.json({ data: { user: serializeUser(user) } })
})

authRouter.post('/auth/logout', requireAuth, async (req, res) => {
  const config = req.app.locals.config
  await revokeSession(req.session)
  clearSessionCookie(res, config)
  await recordSecurityEvent({ type: 'logout', userId: req.user._id, req, logger: req.log })
  res.json({ data: { ok: true } })
})

authRouter.post('/auth/unlock', requireAuth, async (req, res) => {
  const { password } = parse(unlockSchema, req.body ?? {})
  const { valid } = await verifyOwnerPassword(req.user._id, password)

  if (!valid) {
    await recordSecurityEvent({
      type: 'unlock_failed',
      userId: req.user._id,
      req,
      logger: req.log,
    })
    throw new HttpError(401, 'INVALID_PASSWORD', 'The password is incorrect.')
  }

  await recordSecurityEvent({
    type: 'unlock_success',
    userId: req.user._id,
    req,
    logger: req.log,
  })

  res.json({ data: { ok: true, user: serializeUser(req.user) } })
})

authRouter.post('/auth/password', requireAuth, async (req, res) => {
  const data = parse(changePasswordSchema, req.body ?? {})

  const user = await changeOwnerPassword({
    userId: req.user._id,
    currentSessionId: req.session._id,
    currentPassword: data.currentPassword,
    newPassword: data.newPassword,
    req,
    logger: req.log,
  })

  res.json({ data: { ok: true, user: serializeUser(user) } })
})
