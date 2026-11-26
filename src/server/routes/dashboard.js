import { Router } from 'express'
import { parse } from '../lib/http-error.js'
import { requireAuth } from '../middleware/auth.js'
import { objectIdSchema } from '../../shared/validation/reference.js'
import {
  dashboardExpectedVersionSchema,
  dashboardLayoutCreateSchema,
  dashboardLayoutPatchSchema,
  dashboardQuerySchema,
} from '../../shared/validation/dashboard.js'
import {
  WIDGET_CATALOG,
  createDashboardLayout,
  deleteDashboardLayout,
  getDashboardData,
  listDashboardLayouts,
  setDefaultDashboardLayout,
  updateDashboardLayout,
} from '../services/dashboard-service.js'

export const dashboardRouter = Router()

function respond(res, payload, status = 200) {
  res.status(status)
  res.setHeader('Cache-Control', 'no-store')
  res.json({ data: payload })
}

function layoutId(req) {
  return parse(objectIdSchema, req.params.id)
}

dashboardRouter.get('/dashboard/widgets', requireAuth, (req, res) => {
  respond(res, { widgets: WIDGET_CATALOG })
})

dashboardRouter.get('/dashboard/layouts', requireAuth, async (req, res) => {
  respond(res, { layouts: await listDashboardLayouts(req.user._id) })
})

dashboardRouter.post('/dashboard/layouts', requireAuth, async (req, res) => {
  const payload = parse(dashboardLayoutCreateSchema, req.body ?? {})
  respond(res, { layout: await createDashboardLayout(req.user._id, payload) }, 201)
})

dashboardRouter.patch('/dashboard/layouts/:id', requireAuth, async (req, res) => {
  const payload = parse(dashboardLayoutPatchSchema, req.body ?? {})
  respond(res, { layout: await updateDashboardLayout(req.user._id, layoutId(req), payload) })
})

dashboardRouter.delete('/dashboard/layouts/:id', requireAuth, async (req, res) => {
  const { expectedVersion } = parse(dashboardExpectedVersionSchema, req.body ?? {})
  respond(res, {
    layout: await deleteDashboardLayout(req.user._id, layoutId(req), expectedVersion),
  })
})

dashboardRouter.post('/dashboard/layouts/:id/default', requireAuth, async (req, res) => {
  const { expectedVersion } = parse(dashboardExpectedVersionSchema, req.body ?? {})
  respond(res, {
    layout: await setDefaultDashboardLayout(req.user._id, layoutId(req), expectedVersion),
  })
})

dashboardRouter.get('/dashboard/data', requireAuth, async (req, res) => {
  const query = parse(dashboardQuerySchema, req.query ?? {})
  respond(res, await getDashboardData(req.user._id, query))
})
