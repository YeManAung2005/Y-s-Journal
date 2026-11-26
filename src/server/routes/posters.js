import { Router } from 'express'
import { parse } from '../lib/http-error.js'
import { requireAuth } from '../middleware/auth.js'
import { objectIdSchema } from '../../shared/validation/reference.js'
import {
  posterConfigCreateSchema,
  posterConfigPatchSchema,
  posterDataQuerySchema,
  posterExpectedVersionSchema,
} from '../../shared/validation/poster.js'
import {
  createPosterConfig,
  deletePosterConfig,
  getPosterCatalog,
  getPosterData,
  listPosterConfigs,
  updatePosterConfig,
} from '../services/poster-service.js'

export const postersRouter = Router()

function respond(res, payload, status = 200) {
  res.status(status)
  res.setHeader('Cache-Control', 'no-store')
  res.json({ data: payload })
}

function configId(req) {
  return parse(objectIdSchema, req.params.id)
}

postersRouter.get('/posters/catalog', requireAuth, (req, res) => {
  respond(res, getPosterCatalog())
})

postersRouter.get('/posters/configs', requireAuth, async (req, res) => {
  respond(res, { configs: await listPosterConfigs(req.user._id) })
})

postersRouter.post('/posters/configs', requireAuth, async (req, res) => {
  const payload = parse(posterConfigCreateSchema, req.body ?? {})
  respond(res, { config: await createPosterConfig(req.user._id, payload) }, 201)
})

postersRouter.patch('/posters/configs/:id', requireAuth, async (req, res) => {
  const payload = parse(posterConfigPatchSchema, req.body ?? {})
  respond(res, {
    config: await updatePosterConfig(req.user._id, configId(req), payload),
  })
})

postersRouter.delete('/posters/configs/:id', requireAuth, async (req, res) => {
  const { expectedVersion } = parse(posterExpectedVersionSchema, req.body ?? {})
  respond(res, {
    config: await deletePosterConfig(req.user._id, configId(req), expectedVersion),
  })
})

postersRouter.get('/posters/data', requireAuth, async (req, res) => {
  const query = parse(posterDataQuerySchema, req.query ?? {})
  respond(res, await getPosterData(req.user._id, query))
})
