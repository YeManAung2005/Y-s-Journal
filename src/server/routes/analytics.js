import { Router } from 'express'
import {
  analyticsQuerySchema,
  breakdownQuerySchema,
  comparisonQuerySchema,
} from '../../shared/validation/analytics.js'
import { parse } from '../lib/http-error.js'
import { requireAuth } from '../middleware/auth.js'
import {
  getBreakdowns,
  getComparison,
  getEquityCurve,
  getSummary,
} from '../services/analytics-service.js'

export const analyticsRouter = Router()

function respond(res, payload) {
  res.status(200)
  res.setHeader('Cache-Control', 'no-store')
  res.json({ data: payload })
}

analyticsRouter.get('/analytics/summary', requireAuth, async (req, res) => {
  const query = parse(analyticsQuerySchema, req.query ?? {})
  respond(res, {
    filters: query,
    summary: await getSummary(req.user._id, query),
  })
})

analyticsRouter.get('/analytics/equity', requireAuth, async (req, res) => {
  const query = parse(analyticsQuerySchema, req.query ?? {})
  respond(res, {
    filters: query,
    equity: await getEquityCurve(req.user._id, query),
  })
})

analyticsRouter.get('/analytics/breakdowns', requireAuth, async (req, res) => {
  const query = parse(breakdownQuerySchema, req.query ?? {})
  respond(res, {
    filters: query,
    breakdowns: await getBreakdowns(req.user._id, query),
  })
})

analyticsRouter.get('/analytics/compare', requireAuth, async (req, res) => {
  const query = parse(comparisonQuerySchema, req.query ?? {})
  respond(res, {
    filters: query,
    comparison: await getComparison(req.user._id, query),
  })
})
