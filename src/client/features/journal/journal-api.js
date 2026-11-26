import { apiRequest } from '@/lib/api'

function toQuery(params = {}) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  }
  const serialized = query.toString()
  return serialized ? `?${serialized}` : ''
}

export function fetchJournalEntries(params = {}) {
  return apiRequest(`/journal/entries${toQuery(params)}`)
}

export function createJournalEntry(payload) {
  return apiRequest('/journal/entries', { method: 'POST', body: payload })
}

export function updateJournalEntry(entryId, payload) {
  return apiRequest(`/journal/entries/${entryId}`, { method: 'PATCH', body: payload })
}

export function deleteJournalEntry(entryId, expectedVersion) {
  return apiRequest(`/journal/entries/${entryId}`, {
    method: 'DELETE',
    body: { expectedVersion },
  })
}

export function restoreJournalEntry(entryId, expectedVersion) {
  return apiRequest(`/journal/entries/${entryId}/restore`, {
    method: 'POST',
    body: { expectedVersion },
  })
}

export function fetchQuickNotes(params = {}) {
  return apiRequest(`/journal/notes${toQuery(params)}`)
}

export function createQuickNote(payload) {
  return apiRequest('/journal/notes', { method: 'POST', body: payload })
}

export function updateQuickNote(noteId, payload) {
  return apiRequest(`/journal/notes/${noteId}`, { method: 'PATCH', body: payload })
}

export function deleteQuickNote(noteId, expectedVersion) {
  return apiRequest(`/journal/notes/${noteId}`, {
    method: 'DELETE',
    body: { expectedVersion },
  })
}

export function restoreQuickNote(noteId, expectedVersion) {
  return apiRequest(`/journal/notes/${noteId}/restore`, {
    method: 'POST',
    body: { expectedVersion },
  })
}

export function searchJournal(params = {}) {
  return apiRequest(`/journal/search${toQuery(params)}`)
}
