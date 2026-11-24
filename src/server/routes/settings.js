import { Router } from 'express'
import { settingsPatchSchema } from '../../shared/validation/auth.js'
import { parse } from '../lib/http-error.js'
import { requireAuth } from '../middleware/auth.js'
import {
  getOrCreateSettings,
  serializeSettings,
  updateSettings,
} from '../services/settings-service.js'

export const settingsRouter = Router()

settingsRouter.get('/settings', requireAuth, async (req, res) => {
  const settings = await getOrCreateSettings(req.user._id)
  res.setHeader('Cache-Control', 'no-store')
  res.json({ data: { settings: serializeSettings(settings) } })
})

settingsRouter.patch('/settings', requireAuth, async (req, res) => {
  const patch = parse(settingsPatchSchema, req.body ?? {})
  const settings = await updateSettings(req.user._id, patch)
  res.json({ data: { settings: serializeSettings(settings) } })
})
