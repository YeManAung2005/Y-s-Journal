// @vitest-environment node

import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { JournalEntry } from '../../src/server/models/journal-entry.js'
import { QuickNote } from '../../src/server/models/quick-note.js'
import { User } from '../../src/server/models/user.js'
import { connectTestDb, disconnectTestDb, resetTestDb } from '../helpers/test-db.js'
import { buildTestApp, getCsrfToken } from '../helpers/test-app.js'

describe('Phase 6 journal API', () => {
  let app

  beforeAll(async () => {
    await connectTestDb()
  })

  beforeEach(async () => {
    await resetTestDb()
    app = buildTestApp()
  })

  afterAll(async () => {
    await disconnectTestDb()
  })

  async function signedIn() {
    const agent = request.agent(app)
    const csrfToken = await getCsrfToken(agent)
    const response = await agent
      .post('/api/v1/onboarding')
      .set('x-csrf-token', csrfToken)
      .send({
        email: 'owner@example.com',
        displayName: 'Owner',
        password: 'secure-passphrase-123',
        confirmPassword: 'secure-passphrase-123',
      })
      .expect(201)

    return { agent, csrfToken, user: response.body.data.user }
  }

  function send(agent, csrfToken, method, url, body) {
    const call = agent[method](url).set('x-csrf-token', csrfToken)
    return body === undefined ? call : call.send(body)
  }

  async function foreignRecords() {
    const foreign = await User.create({
      email: 'other@example.com',
      passwordHash: 'unused-test-hash',
      displayName: 'Other',
    })
    const entry = await JournalEntry.create({
      userId: foreign._id,
      date: '2026-11-25',
      highlights: 'Foreign entry',
      gratitude: [],
      mood: null,
      reflection: '',
      freeWriting: '',
      tomorrowPriorities: [],
    })
    const note = await QuickNote.create({
      userId: foreign._id,
      date: '2026-11-25',
      text: 'Foreign note',
    })
    return { foreign, entry, note }
  }

  function entryPayload(overrides = {}) {
    return {
      date: '2026-11-25',
      highlights: 'A good day',
      challenges: 'A hard task',
      lessons: 'Keep going',
      gratitude: ['Good health'],
      mood: 4,
      reflection: 'Reflective text',
      freeWriting: 'Free writing text',
      tomorrowPriorities: ['Finish the report'],
      ...overrides,
    }
  }

  it('requires authentication and CSRF', async () => {
    const unauthenticated = await request(app).get('/api/v1/journal/entries')
    expect(unauthenticated.status).toBe(401)

    const { agent } = await signedIn()
    const missingCsrf = await agent.post('/api/v1/journal/entries').send(entryPayload())
    expect(missingCsrf.status).toBe(403)
    expect(missingCsrf.body.error.code).toBe('CSRF_INVALID')
  })

  it('creates, reads, updates, and soft-deletes an entry', async () => {
    const { agent, csrfToken } = await signedIn()

    const created = await send(
      agent,
      csrfToken,
      'post',
      '/api/v1/journal/entries',
      entryPayload(),
    ).expect(201)
    expect(created.body.data.entry).toMatchObject({
      date: '2026-11-25',
      highlights: 'A good day',
      mood: 4,
      version: 0,
      deletedAt: null,
    })

    const entryId = created.body.data.entry.id

    const listed = await agent.get('/api/v1/journal/entries').expect(200)
    expect(listed.body.data.entries).toHaveLength(1)

    const updated = await send(agent, csrfToken, 'patch', `/api/v1/journal/entries/${entryId}`, {
      highlights: 'An even better day',
      expectedVersion: 0,
    }).expect(200)
    expect(updated.body.data.entry.highlights).toBe('An even better day')
    expect(updated.body.data.entry.version).toBe(1)

    await send(agent, csrfToken, 'delete', `/api/v1/journal/entries/${entryId}`, {
      expectedVersion: 1,
    }).expect(200)

    const afterDelete = await agent.get('/api/v1/journal/entries').expect(200)
    expect(afterDelete.body.data.entries).toHaveLength(0)

    const withDeleted = await agent.get('/api/v1/journal/entries?includeDeleted=true').expect(200)
    expect(withDeleted.body.data.entries).toHaveLength(1)
    expect(withDeleted.body.data.entries[0].deletedAt).toBeTruthy()
  })

  it('enforces one active entry per date', async () => {
    const { agent, csrfToken } = await signedIn()

    await send(agent, csrfToken, 'post', '/api/v1/journal/entries', entryPayload()).expect(201)
    const duplicate = await send(
      agent,
      csrfToken,
      'post',
      '/api/v1/journal/entries',
      entryPayload({ highlights: 'Duplicate' }),
    ).expect(409)

    expect(duplicate.body.error.code).toBe('CONFLICT')
  })

  it('detects stale updates and restores deleted entries', async () => {
    const { agent, csrfToken } = await signedIn()

    const created = await send(
      agent,
      csrfToken,
      'post',
      '/api/v1/journal/entries',
      entryPayload(),
    ).expect(201)
    const id = created.body.data.entry.id

    await send(agent, csrfToken, 'patch', `/api/v1/journal/entries/${id}`, {
      highlights: 'First update',
      expectedVersion: 0,
    }).expect(200)

    const stale = await send(agent, csrfToken, 'patch', `/api/v1/journal/entries/${id}`, {
      highlights: 'Stale update',
      expectedVersion: 0,
    }).expect(409)
    expect(stale.body.error.code).toBe('VERSION_CONFLICT')

    await send(agent, csrfToken, 'delete', `/api/v1/journal/entries/${id}`, {
      expectedVersion: 1,
    }).expect(200)

    const restored = await send(agent, csrfToken, 'post', `/api/v1/journal/entries/${id}/restore`, {
      expectedVersion: 2,
    }).expect(200)
    expect(restored.body.data.entry.deletedAt).toBeNull()
    expect(restored.body.data.entry.version).toBe(3)
  })

  it('isolates journal entries by owner', async () => {
    const { agent, csrfToken } = await signedIn()
    const { entry } = await foreignRecords()

    await agent.get(`/api/v1/journal/entries/${entry.id}`).expect(404)
    await send(agent, csrfToken, 'patch', `/api/v1/journal/entries/${entry.id}`, {
      highlights: 'Hacked',
      expectedVersion: 0,
    }).expect(404)
    await send(agent, csrfToken, 'delete', `/api/v1/journal/entries/${entry.id}`, {
      expectedVersion: 0,
    }).expect(404)

    const list = await agent.get('/api/v1/journal/entries').expect(200)
    expect(list.body.data.entries).toHaveLength(0)
  })

  it('creates, edits, deletes, and restores quick notes', async () => {
    const { agent, csrfToken } = await signedIn()

    const created = await send(agent, csrfToken, 'post', '/api/v1/journal/notes', {
      date: '2026-11-25',
      text: 'A quick thought',
    }).expect(201)
    const id = created.body.data.note.id

    const updated = await send(agent, csrfToken, 'patch', `/api/v1/journal/notes/${id}`, {
      text: 'Updated thought',
      expectedVersion: 0,
    }).expect(200)
    expect(updated.body.data.note.text).toBe('Updated thought')

    await send(agent, csrfToken, 'delete', `/api/v1/journal/notes/${id}`, {
      expectedVersion: 1,
    }).expect(200)
    await send(agent, csrfToken, 'post', `/api/v1/journal/notes/${id}/restore`, {
      expectedVersion: 2,
    }).expect(200)

    const notes = await agent.get('/api/v1/journal/notes').expect(200)
    expect(notes.body.data.notes).toHaveLength(1)
    expect(notes.body.data.notes[0].text).toBe('Updated thought')
  })

  it('isolates quick notes by owner', async () => {
    const { agent, csrfToken } = await signedIn()
    const { note } = await foreignRecords()

    await send(agent, csrfToken, 'patch', `/api/v1/journal/notes/${note.id}`, {
      text: 'Hacked',
      expectedVersion: 0,
    }).expect(404)
    const notes = await agent.get('/api/v1/journal/notes').expect(200)
    expect(notes.body.data.notes).toHaveLength(0)
  })

  it('searches entries and notes with owner isolation', async () => {
    const { agent, csrfToken } = await signedIn()

    await send(agent, csrfToken, 'post', '/api/v1/journal/entries', entryPayload()).expect(201)
    await send(agent, csrfToken, 'post', '/api/v1/journal/notes', {
      date: '2026-11-25',
      text: 'A good idea',
    }).expect(201)
    await foreignRecords()

    const all = await agent.get('/api/v1/journal/search?q=good').expect(200)
    expect(all.body.data.entries).toHaveLength(1)
    expect(all.body.data.notes).toHaveLength(1)

    const entriesOnly = await agent.get('/api/v1/journal/search?q=good&scope=entries').expect(200)
    expect(entriesOnly.body.data.entries).toHaveLength(1)
    expect(entriesOnly.body.data.notes).toHaveLength(0)

    const notesOnly = await agent.get('/api/v1/journal/search?q=good&scope=notes').expect(200)
    expect(notesOnly.body.data.entries).toHaveLength(0)
    expect(notesOnly.body.data.notes).toHaveLength(1)
  })

  it('does not search deleted records', async () => {
    const { agent, csrfToken } = await signedIn()

    const created = await send(
      agent,
      csrfToken,
      'post',
      '/api/v1/journal/entries',
      entryPayload(),
    ).expect(201)
    await send(
      agent,
      csrfToken,
      'delete',
      `/api/v1/journal/entries/${created.body.data.entry.id}`,
      {
        expectedVersion: 0,
      },
    ).expect(200)

    const results = await agent.get('/api/v1/journal/search?q=good').expect(200)
    expect(results.body.data.entries).toHaveLength(0)
  })

  it('saves and serializes reminder preferences', async () => {
    const { agent, csrfToken } = await signedIn()

    const patched = await send(agent, csrfToken, 'patch', '/api/v1/settings', {
      reminders: { journalEnabled: true, journalTime: '21:30' },
    }).expect(200)
    expect(patched.body.data.settings.reminders).toMatchObject({
      journalEnabled: true,
      journalTime: '21:30',
    })

    const settings = await agent.get('/api/v1/settings').expect(200)
    expect(settings.body.data.settings.reminders).toMatchObject({
      journalEnabled: true,
      journalTime: '21:30',
    })
  })

  it('rejects invalid reminder times', async () => {
    const { agent, csrfToken } = await signedIn()

    await send(agent, csrfToken, 'patch', '/api/v1/settings', {
      reminders: { journalTime: '9:00 PM' },
    }).expect(400)
  })
})
