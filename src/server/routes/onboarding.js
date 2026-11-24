import { Router } from 'express'
import { onboardingSchema } from '../../shared/validation/auth.js'
import { parse } from '../lib/http-error.js'
import { setSessionCookie } from '../lib/cookies.js'
import { createOwner, isSetupRequired, serializeUser } from '../services/auth-service.js'

export const onboardingRouter = Router()

onboardingRouter.get('/onboarding/status', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  res.json({ data: { setupRequired: await isSetupRequired() } })
})

onboardingRouter.post('/onboarding', async (req, res) => {
  const config = req.app.locals.config
  const data = parse(onboardingSchema, req.body ?? {})

  const { user, token } = await createOwner({
    email: data.email,
    displayName: data.displayName,
    password: data.password,
    req,
    logger: req.log,
  })

  setSessionCookie(res, token, config)
  res.status(201).json({ data: { user: serializeUser(user) } })
})
