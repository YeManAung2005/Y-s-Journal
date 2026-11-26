import { Router } from 'express'
import {
  accountCreateSchema,
  accountPatchSchema,
  checklistCreateSchema,
  checklistPatchSchema,
  includeArchivedSchema,
  instrumentCreateSchema,
  instrumentPatchSchema,
  objectIdSchema,
  tagCreateSchema,
  tagPatchSchema,
  tradingSessionCreateSchema,
  tradingSessionPatchSchema,
} from '../../shared/validation/reference.js'
import { parse } from '../lib/http-error.js'
import { requireAuth } from '../middleware/auth.js'
import {
  archiveAccount,
  archiveChecklistItem,
  archiveInstrument,
  archiveTag,
  archiveTradingSession,
  createAccount,
  createChecklistItem,
  createInstrument,
  createTag,
  createTradingSession,
  listReferenceData,
  restoreAccount,
  restoreChecklistItem,
  restoreInstrument,
  restoreTag,
  restoreTradingSession,
  setDefaultAccount,
  updateAccount,
  updateChecklistItem,
  updateInstrument,
  updateTag,
  updateTradingSession,
} from '../services/reference-data-service.js'

export const referenceRouter = Router()

function recordId(req) {
  return parse(objectIdSchema, req.params.id)
}

function archivedFlag(req) {
  return parse(includeArchivedSchema, req.query.includeArchived)
}

function respond(res, record, name = 'record', status = 200) {
  res.status(status)
  res.setHeader('Cache-Control', 'no-store')
  res.json({ data: { [name]: record } })
}

referenceRouter.get('/reference', requireAuth, async (req, res) => {
  const data = await listReferenceData(req.user._id, archivedFlag(req))
  res.setHeader('Cache-Control', 'no-store')
  res.json({ data })
})

referenceRouter.post('/reference/instruments', requireAuth, async (req, res) => {
  const record = await createInstrument(req.user._id, parse(instrumentCreateSchema, req.body ?? {}))
  respond(res, record, 'instrument', 201)
})

referenceRouter.patch('/reference/instruments/:id', requireAuth, async (req, res) => {
  const record = await updateInstrument(
    req.user._id,
    recordId(req),
    parse(instrumentPatchSchema, req.body ?? {}),
  )
  respond(res, record, 'instrument')
})

referenceRouter.post('/reference/instruments/:id/archive', requireAuth, async (req, res) => {
  respond(res, await archiveInstrument(req.user._id, recordId(req)), 'instrument')
})

referenceRouter.post('/reference/instruments/:id/restore', requireAuth, async (req, res) => {
  respond(res, await restoreInstrument(req.user._id, recordId(req)), 'instrument')
})

referenceRouter.post('/reference/accounts', requireAuth, async (req, res) => {
  const record = await createAccount(req.user._id, parse(accountCreateSchema, req.body ?? {}))
  respond(res, record, 'account', 201)
})

referenceRouter.patch('/reference/accounts/:id', requireAuth, async (req, res) => {
  const record = await updateAccount(
    req.user._id,
    recordId(req),
    parse(accountPatchSchema, req.body ?? {}),
  )
  respond(res, record, 'account')
})

referenceRouter.post('/reference/accounts/:id/set-default', requireAuth, async (req, res) => {
  respond(res, await setDefaultAccount(req.user._id, recordId(req)), 'account')
})

referenceRouter.post('/reference/accounts/:id/archive', requireAuth, async (req, res) => {
  respond(res, await archiveAccount(req.user._id, recordId(req)), 'account')
})

referenceRouter.post('/reference/accounts/:id/restore', requireAuth, async (req, res) => {
  respond(res, await restoreAccount(req.user._id, recordId(req)), 'account')
})

referenceRouter.post('/reference/tags', requireAuth, async (req, res) => {
  const record = await createTag(req.user._id, parse(tagCreateSchema, req.body ?? {}))
  respond(res, record, 'tag', 201)
})

referenceRouter.patch('/reference/tags/:id', requireAuth, async (req, res) => {
  const record = await updateTag(req.user._id, recordId(req), parse(tagPatchSchema, req.body ?? {}))
  respond(res, record, 'tag')
})

referenceRouter.post('/reference/tags/:id/archive', requireAuth, async (req, res) => {
  respond(res, await archiveTag(req.user._id, recordId(req)), 'tag')
})

referenceRouter.post('/reference/tags/:id/restore', requireAuth, async (req, res) => {
  respond(res, await restoreTag(req.user._id, recordId(req)), 'tag')
})

referenceRouter.post('/reference/trading-sessions', requireAuth, async (req, res) => {
  const record = await createTradingSession(
    req.user._id,
    parse(tradingSessionCreateSchema, req.body ?? {}),
  )
  respond(res, record, 'tradingSession', 201)
})

referenceRouter.patch('/reference/trading-sessions/:id', requireAuth, async (req, res) => {
  const record = await updateTradingSession(
    req.user._id,
    recordId(req),
    parse(tradingSessionPatchSchema, req.body ?? {}),
  )
  respond(res, record, 'tradingSession')
})

referenceRouter.post('/reference/trading-sessions/:id/archive', requireAuth, async (req, res) => {
  respond(res, await archiveTradingSession(req.user._id, recordId(req)), 'tradingSession')
})

referenceRouter.post('/reference/trading-sessions/:id/restore', requireAuth, async (req, res) => {
  respond(res, await restoreTradingSession(req.user._id, recordId(req)), 'tradingSession')
})

referenceRouter.post('/reference/checklist', requireAuth, async (req, res) => {
  const record = await createChecklistItem(
    req.user._id,
    parse(checklistCreateSchema, req.body ?? {}),
  )
  respond(res, record, 'checklistItem', 201)
})

referenceRouter.patch('/reference/checklist/:id', requireAuth, async (req, res) => {
  const record = await updateChecklistItem(
    req.user._id,
    recordId(req),
    parse(checklistPatchSchema, req.body ?? {}),
  )
  respond(res, record, 'checklistItem')
})

referenceRouter.post('/reference/checklist/:id/archive', requireAuth, async (req, res) => {
  respond(res, await archiveChecklistItem(req.user._id, recordId(req)), 'checklistItem')
})

referenceRouter.post('/reference/checklist/:id/restore', requireAuth, async (req, res) => {
  respond(res, await restoreChecklistItem(req.user._id, recordId(req)), 'checklistItem')
})
