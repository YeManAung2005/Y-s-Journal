import { JournalEntry } from '../models/journal-entry.js'
import { QuickNote } from '../models/quick-note.js'
import { HttpError } from '../lib/http-error.js'

function notFound(message = 'The requested journal record was not found.') {
  throw new HttpError(404, 'NOT_FOUND', message)
}

function versionConflict() {
  throw new HttpError(409, 'VERSION_CONFLICT', 'This journal record changed. Reload and try again.')
}

function duplicateEntry() {
  throw new HttpError(409, 'CONFLICT', 'A journal entry already exists for that date.')
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function textPattern(value) {
  return new RegExp(escapeRegExp(value), 'i')
}

const ENTRY_TEXT_FIELDS = [
  'highlights',
  'challenges',
  'lessons',
  'reflection',
  'freeWriting',
  'gratitude',
  'tomorrowPriorities',
]

export function serializeJournalEntry(entry) {
  return {
    id: entry._id.toString(),
    date: entry.date,
    highlights: entry.highlights,
    challenges: entry.challenges,
    lessons: entry.lessons,
    gratitude: [...entry.gratitude],
    mood: entry.mood,
    reflection: entry.reflection,
    freeWriting: entry.freeWriting,
    tomorrowPriorities: [...entry.tomorrowPriorities],
    version: entry.version,
    deletedAt: entry.deletedAt,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }
}

export function serializeQuickNote(note) {
  return {
    id: note._id.toString(),
    date: note.date,
    text: note.text,
    version: note.version,
    deletedAt: note.deletedAt,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  }
}

function dateFilter(query, target = {}) {
  if (query.date) {
    target.date = query.date
    return target
  }
  if (query.from || query.to) {
    target.date = {}
    if (query.from) target.date.$gte = query.from
    if (query.to) target.date.$lte = query.to
  }
  return target
}

function searchFilter(query, fields) {
  if (!query.q) return null
  const pattern = textPattern(query.q)
  return { $or: fields.map((field) => ({ [field]: pattern })) }
}

export async function listJournalEntries(userId, query) {
  const filter = dateFilter(query, { userId })
  if (!query.includeDeleted) filter.deletedAt = null

  const search = searchFilter(query, ENTRY_TEXT_FIELDS)
  if (search) Object.assign(filter, search)

  const entries = await JournalEntry.find(filter)
    .sort({ date: -1, createdAt: -1 })
    .limit(query.limit)

  return entries.map(serializeJournalEntry)
}

export async function getJournalEntry(userId, entryId) {
  const entry = await JournalEntry.findOne({ _id: entryId, userId, deletedAt: null })
  if (!entry) notFound('The requested journal entry was not found.')
  return serializeJournalEntry(entry)
}

export async function getJournalEntryByDate(userId, date) {
  const entry = await JournalEntry.findOne({ userId, date, deletedAt: null })
  return entry ? serializeJournalEntry(entry) : null
}

export async function createJournalEntry(userId, payload) {
  if (await JournalEntry.exists({ userId, date: payload.date, deletedAt: null })) {
    duplicateEntry()
  }

  try {
    const entry = await JournalEntry.create({
      userId,
      date: payload.date,
      highlights: payload.highlights,
      challenges: payload.challenges,
      lessons: payload.lessons,
      gratitude: payload.gratitude,
      mood: payload.mood,
      reflection: payload.reflection,
      freeWriting: payload.freeWriting,
      tomorrowPriorities: payload.tomorrowPriorities,
      version: 0,
      deletedAt: null,
    })
    return serializeJournalEntry(entry)
  } catch (error) {
    if (error?.code === 11000) duplicateEntry()
    throw error
  }
}

export async function updateJournalEntry(userId, entryId, payload) {
  const existing = await JournalEntry.findOne({ _id: entryId, userId, deletedAt: null })
  if (!existing) notFound('The requested journal entry was not found.')

  if (payload.date && payload.date !== existing.date) {
    if (await JournalEntry.exists({ userId, date: payload.date, deletedAt: null })) {
      duplicateEntry()
    }
  }

  const patch = {}
  for (const field of [
    'date',
    'highlights',
    'challenges',
    'lessons',
    'gratitude',
    'mood',
    'reflection',
    'freeWriting',
    'tomorrowPriorities',
  ]) {
    if (payload[field] !== undefined) patch[field] = payload[field]
  }

  try {
    const result = await JournalEntry.updateOne(
      { _id: entryId, userId, version: payload.expectedVersion, deletedAt: null },
      { $set: { ...patch, version: payload.expectedVersion + 1 } },
    )
    if (result.matchedCount === 0) versionConflict()
  } catch (error) {
    if (error?.code === 11000) duplicateEntry()
    throw error
  }

  return getJournalEntry(userId, entryId)
}

export async function deleteJournalEntry(userId, entryId, expectedVersion) {
  const result = await JournalEntry.updateOne(
    { _id: entryId, userId, version: expectedVersion, deletedAt: null },
    { $set: { deletedAt: new Date(), deletedBy: userId, version: expectedVersion + 1 } },
  )
  if (result.matchedCount === 0) {
    if (!(await JournalEntry.exists({ _id: entryId, userId }))) {
      notFound('The requested journal entry was not found.')
    }
    versionConflict()
  }

  const deleted = await JournalEntry.findOne({ _id: entryId, userId })
  return serializeJournalEntry(deleted)
}

export async function restoreJournalEntry(userId, entryId, expectedVersion) {
  const existing = await JournalEntry.findOne({ _id: entryId, userId, deletedAt: { $ne: null } })
  if (!existing) notFound('The requested journal entry was not found.')

  if (await JournalEntry.exists({ userId, date: existing.date, deletedAt: null })) {
    duplicateEntry()
  }

  const result = await JournalEntry.updateOne(
    { _id: entryId, userId, version: expectedVersion, deletedAt: { $ne: null } },
    { $set: { deletedAt: null, deletedBy: null, version: expectedVersion + 1 } },
  )
  if (result.matchedCount === 0) versionConflict()

  return getJournalEntry(userId, entryId)
}

export async function listQuickNotes(userId, query) {
  const filter = dateFilter(query, { userId })
  if (!query.includeDeleted) filter.deletedAt = null

  const search = searchFilter(query, ['text'])
  if (search) Object.assign(filter, search)

  const notes = await QuickNote.find(filter).sort({ date: -1, createdAt: -1 }).limit(query.limit)

  return notes.map(serializeQuickNote)
}

export async function createQuickNote(userId, payload) {
  const note = await QuickNote.create({
    userId,
    date: payload.date,
    text: payload.text,
    version: 0,
    deletedAt: null,
  })
  return serializeQuickNote(note)
}

export async function getQuickNote(userId, noteId) {
  const note = await QuickNote.findOne({ _id: noteId, userId, deletedAt: null })
  if (!note) notFound('The requested quick note was not found.')
  return serializeQuickNote(note)
}

export async function updateQuickNote(userId, noteId, payload) {
  const patch = {}
  if (payload.date !== undefined) patch.date = payload.date
  if (payload.text !== undefined) patch.text = payload.text

  const result = await QuickNote.updateOne(
    { _id: noteId, userId, version: payload.expectedVersion, deletedAt: null },
    { $set: { ...patch, version: payload.expectedVersion + 1 } },
  )
  if (result.matchedCount === 0) {
    if (!(await QuickNote.exists({ _id: noteId, userId }))) {
      notFound('The requested quick note was not found.')
    }
    versionConflict()
  }

  return getQuickNote(userId, noteId)
}

export async function deleteQuickNote(userId, noteId, expectedVersion) {
  const result = await QuickNote.updateOne(
    { _id: noteId, userId, version: expectedVersion, deletedAt: null },
    { $set: { deletedAt: new Date(), deletedBy: userId, version: expectedVersion + 1 } },
  )
  if (result.matchedCount === 0) {
    if (!(await QuickNote.exists({ _id: noteId, userId }))) {
      notFound('The requested quick note was not found.')
    }
    versionConflict()
  }

  const deleted = await QuickNote.findOne({ _id: noteId, userId })
  return serializeQuickNote(deleted)
}

export async function restoreQuickNote(userId, noteId, expectedVersion) {
  const result = await QuickNote.updateOne(
    { _id: noteId, userId, version: expectedVersion, deletedAt: { $ne: null } },
    { $set: { deletedAt: null, deletedBy: null, version: expectedVersion + 1 } },
  )
  if (result.matchedCount === 0) {
    if (!(await QuickNote.exists({ _id: noteId, userId }))) {
      notFound('The requested quick note was not found.')
    }
    versionConflict()
  }

  return getQuickNote(userId, noteId)
}

export async function searchJournal(userId, query) {
  const includeEntries = query.scope !== 'notes'
  const includeNotes = query.scope !== 'entries'

  const [entries, notes] = await Promise.all([
    includeEntries ? listJournalEntries(userId, { ...query, includeDeleted: false }) : [],
    includeNotes ? listQuickNotes(userId, { ...query, includeDeleted: false }) : [],
  ])

  return { entries, notes }
}
