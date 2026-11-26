import { Router } from 'express'
import {
  accountAdjustmentCreateSchema,
  accountAdjustmentDeleteSchema,
} from '../../shared/validation/account-adjustment.js'
import { analyticsQuerySchema } from '../../shared/validation/analytics.js'
import { objectIdSchema } from '../../shared/validation/reference.js'
import { parse } from '../lib/http-error.js'
import { requireAuth } from '../middleware/auth.js'
import {
  createAdjustment,
  deleteAdjustment,
  listAdjustments,
} from '../services/account-adjustment-service.js'

export const accountAdjustmentsRouter = Router()

function respond(res, payload, status = 200) {
  res.status(status)
  res.setHeader('Cache-Control', 'no-store')
  res.json({ data: payload })
}

accountAdjustmentsRouter.get('/accounts/:accountId/adjustments', requireAuth, async (req, res) => {
  const query = parse(analyticsQuerySchema, req.query ?? {})
  respond(res, {
    adjustments: await listAdjustments(req.user._id, {
      ...query,
      accountId: parse(objectIdSchema, req.params.accountId),
    }),
  })
})

accountAdjustmentsRouter.post('/accounts/:accountId/adjustments', requireAuth, async (req, res) => {
  const payload = parse(accountAdjustmentCreateSchema, {
    ...(req.body ?? {}),
    accountId: parse(objectIdSchema, req.params.accountId),
  })
  respond(res, { adjustment: await createAdjustment(req.user._id, payload) }, 201)
})

accountAdjustmentsRouter.delete('/account-adjustments/:id', requireAuth, async (req, res) => {
  const { expectedVersion } = parse(accountAdjustmentDeleteSchema, req.body ?? {})
  respond(res, {
    adjustment: await deleteAdjustment(
      req.user._id,
      parse(objectIdSchema, req.params.id),
      expectedVersion,
    ),
  })
})
