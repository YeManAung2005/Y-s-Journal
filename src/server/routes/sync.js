import { Router } from 'express'
import { parse } from '../lib/http-error.js'
import { requireAuth } from '../middleware/auth.js'
import { objectIdSchema } from '../../shared/validation/reference.js'
import { getSyncResource } from '../services/sync-service.js'

export const syncRouter = Router()

syncRouter.get('/sync/resources/:type/:id', requireAuth, async (req, res, next) => {
  try {
    const id = parse(objectIdSchema, req.params.id)
    const resource = await getSyncResource(req.user.id, req.params.type, id)
    res.status(200)
    res.setHeader('Cache-Control', 'no-store')
    res.json({ data: { resource } })
  } catch (error) {
    next(error)
  }
})
