import { Router } from 'express'
import { parse } from '../lib/http-error.js'
import { requireAuth } from '../middleware/auth.js'
import { objectIdSchema } from '../../shared/validation/reference.js'
import {
  journalEntryCreateSchema,
  journalEntryPatchSchema,
  journalEntryQuerySchema,
  journalExpectedVersionSchema,
  journalSearchQuerySchema,
  quickNoteCreateSchema,
  quickNotePatchSchema,
  quickNoteQuerySchema,
} from '../../shared/validation/journal.js'
import {
  createJournalEntry,
  createQuickNote,
  deleteJournalEntry,
  deleteQuickNote,
  getJournalEntry,
  listJournalEntries,
  listQuickNotes,
  restoreJournalEntry,
  restoreQuickNote,
  searchJournal,
  updateJournalEntry,
  updateQuickNote,
} from '../services/journal-service.js'

export const journalRouter = Router()

function entryId(req) {
  return parse(objectIdSchema, req.params.id)
}

function respond(res, payload, status = 200) {
  res.status(status)
  res.setHeader('Cache-Control', 'no-store')
  res.json({ data: payload })
}

journalRouter.get('/journal/entries', requireAuth, async (req, res) => {
  const query = parse(journalEntryQuerySchema, req.query ?? {})
  respond(res, { entries: await listJournalEntries(req.user._id, query) })
})

journalRouter.post('/journal/entries', requireAuth, async (req, res) => {
  const payload = parse(journalEntryCreateSchema, req.body ?? {})
  respond(res, { entry: await createJournalEntry(req.user._id, payload) }, 201)
})

journalRouter.get('/journal/entries/:id', requireAuth, async (req, res) => {
  respond(res, { entry: await getJournalEntry(req.user._id, entryId(req)) })
})

journalRouter.patch('/journal/entries/:id', requireAuth, async (req, res) => {
  const payload = parse(journalEntryPatchSchema, req.body ?? {})
  respond(res, { entry: await updateJournalEntry(req.user._id, entryId(req), payload) })
})

journalRouter.delete('/journal/entries/:id', requireAuth, async (req, res) => {
  const { expectedVersion } = parse(journalExpectedVersionSchema, req.body ?? {})
  respond(res, { entry: await deleteJournalEntry(req.user._id, entryId(req), expectedVersion) })
})

journalRouter.post('/journal/entries/:id/restore', requireAuth, async (req, res) => {
  const { expectedVersion } = parse(journalExpectedVersionSchema, req.body ?? {})
  respond(res, { entry: await restoreJournalEntry(req.user._id, entryId(req), expectedVersion) })
})

journalRouter.get('/journal/notes', requireAuth, async (req, res) => {
  const query = parse(quickNoteQuerySchema, req.query ?? {})
  respond(res, { notes: await listQuickNotes(req.user._id, query) })
})

journalRouter.post('/journal/notes', requireAuth, async (req, res) => {
  const payload = parse(quickNoteCreateSchema, req.body ?? {})
  respond(res, { note: await createQuickNote(req.user._id, payload) }, 201)
})

journalRouter.patch('/journal/notes/:id', requireAuth, async (req, res) => {
  const payload = parse(quickNotePatchSchema, req.body ?? {})
  respond(res, { note: await updateQuickNote(req.user._id, entryId(req), payload) })
})

journalRouter.delete('/journal/notes/:id', requireAuth, async (req, res) => {
  const { expectedVersion } = parse(journalExpectedVersionSchema, req.body ?? {})
  respond(res, { note: await deleteQuickNote(req.user._id, entryId(req), expectedVersion) })
})

journalRouter.post('/journal/notes/:id/restore', requireAuth, async (req, res) => {
  const { expectedVersion } = parse(journalExpectedVersionSchema, req.body ?? {})
  respond(res, { note: await restoreQuickNote(req.user._id, entryId(req), expectedVersion) })
})

journalRouter.get('/journal/search', requireAuth, async (req, res) => {
  const query = parse(journalSearchQuerySchema, req.query ?? {})
  respond(res, await searchJournal(req.user._id, query))
})
