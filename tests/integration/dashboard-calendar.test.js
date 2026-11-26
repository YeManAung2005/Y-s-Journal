// @vitest-environment node

import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { DashboardLayout } from '../../src/server/models/dashboard-layout.js'
import { JournalEntry } from '../../src/server/models/journal-entry.js'
import { User } from '../../src/server/models/user.js'
import { todayInTimeZone } from '../../src/server/lib/timezone.js'
import { connectTestDb, disconnectTestDb, resetTestDb } from '../helpers/test-db.js'
import { buildTestApp, getCsrfToken, setupOwner } from '../helpers/test-app.js'

describe('Phase 7 dashboard and calendar API', () => {
  let app
  const today = todayInTimeZone()
  const month = today.slice(0, 7)

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
    const user = await setupOwner(agent)
    return { agent, csrfToken: await getCsrfToken(agent), user }
  }

  function send(agent, csrfToken, method, url, body) {
    const call = agent[method](url).set('x-csrf-token', csrfToken)
    return body === undefined ? call : call.send(body)
  }

  async function foreignUser() {
    return User.create({
      email: 'foreign@example.com',
      passwordHash: 'unused-test-hash',
      displayName: 'Foreign',
    })
  }

  async function seedActivity(agent, csrfToken, journalContent) {
    const reference = await agent.get('/api/v1/reference').expect(200)
    const account = reference.body.data.accounts[0]
    const instrument = reference.body.data.instruments.find((item) => item.symbol === 'NQ')

    await send(agent, csrfToken, 'post', '/api/v1/trades', {
      accountId: account.id,
      instrumentId: instrument.id,
      direction: 'long',
      entryPrice: '25000.00',
      quantity: '1.00',
      initialStopPrice: '24990.00',
      manualRisk: null,
      tradeDate: today,
      exits: [{ price: '25010.00', quantity: '1.00' }],
      fees: '5.00',
    }).expect(201)

    const category = await send(agent, csrfToken, 'post', '/api/v1/learning/categories', {
      name: 'Web development',
      color: '#8b5cf6',
    }).expect(201)

    await send(agent, csrfToken, 'post', '/api/v1/learning/records', {
      date: today,
      categoryId: category.body.data.category.id,
      topic: 'React hooks',
      durationMinutes: 45,
    }).expect(201)

    await send(agent, csrfToken, 'post', '/api/v1/learning/goals', {
      title: 'Complete the React course',
      categoryId: category.body.data.category.id,
      targetDate: today,
    }).expect(201)

    await send(agent, csrfToken, 'post', '/api/v1/journal/entries', {
      date: today,
      freeWriting: journalContent,
      gratitude: ['Private gratitude'],
    }).expect(201)
  }

  it('requires authentication and validates Phase 7 queries', async () => {
    expect((await request(app).get('/api/v1/dashboard/data')).status).toBe(401)
    expect((await request(app).get('/api/v1/calendar/month?month=2026-11')).status).toBe(401)

    const { agent } = await signedIn()
    expect((await agent.get('/api/v1/calendar/month?month=2026-13')).status).toBe(400)
    expect((await agent.get('/api/v1/dashboard/data?layoutId=oops')).status).toBe(400)

    const missingCsrf = await agent.post('/api/v1/dashboard/layouts').send({ name: 'Focus' })
    expect(missingCsrf.status).toBe(403)
    expect(missingCsrf.body.error.code).toBe('CSRF_INVALID')
  })

  it('creates, updates, defaults, and deletes owner layouts with version checks', async () => {
    const { agent, csrfToken } = await signedIn()

    const initial = await agent.get('/api/v1/dashboard/layouts').expect(200)
    expect(initial.body.data.layouts).toHaveLength(1)
    const defaultLayout = initial.body.data.layouts[0]
    expect(defaultLayout).toMatchObject({ name: 'Default dashboard', isDefault: true, version: 0 })
    expect(defaultLayout.widgets.map((widget) => widget.id)).toEqual([
      'trades_summary',
      'study_summary',
      'calendar_activity',
      'goals_progress',
    ])
    expect(defaultLayout.widgets.find((widget) => widget.id === 'calendar_activity')).toMatchObject(
      {
        size: 'large',
      },
    )

    const created = await send(agent, csrfToken, 'post', '/api/v1/dashboard/layouts', {
      name: 'Focus',
      widgets: [
        {
          id: 'trades_summary',
          visible: true,
          size: 'large',
          position: 0,
          settings: { basis: 'net', days: 7 },
        },
      ],
    }).expect(201)
    const layout = created.body.data.layout
    expect(layout).toMatchObject({ name: 'Focus', isDefault: false, version: 0 })

    const renamed = await send(
      agent,
      csrfToken,
      'patch',
      `/api/v1/dashboard/layouts/${layout.id}`,
      {
        name: 'Deep focus',
        expectedVersion: 0,
      },
    ).expect(200)
    expect(renamed.body.data.layout).toMatchObject({ name: 'Deep focus', version: 1 })

    const stalePatch = await send(
      agent,
      csrfToken,
      'patch',
      `/api/v1/dashboard/layouts/${layout.id}`,
      {
        name: 'Stale name',
        expectedVersion: 0,
      },
    )
    expect(stalePatch.status).toBe(409)
    expect(stalePatch.body.error.code).toBe('VERSION_CONFLICT')

    const staleDefault = await send(
      agent,
      csrfToken,
      'post',
      `/api/v1/dashboard/layouts/${layout.id}/default`,
      { expectedVersion: 0 },
    )
    expect(staleDefault.status).toBe(409)
    expect(staleDefault.body.error.code).toBe('VERSION_CONFLICT')

    const madeDefault = await send(
      agent,
      csrfToken,
      'post',
      `/api/v1/dashboard/layouts/${layout.id}/default`,
      { expectedVersion: 1 },
    ).expect(200)
    expect(madeDefault.body.data.layout).toMatchObject({ isDefault: true, version: 2 })

    const deleteDefault = await send(
      agent,
      csrfToken,
      'delete',
      `/api/v1/dashboard/layouts/${layout.id}`,
      { expectedVersion: 2 },
    )
    expect(deleteDefault.status).toBe(409)
    expect(deleteDefault.body.error.code).toBe('DEFAULT_LAYOUT')

    const disposable = await send(agent, csrfToken, 'post', '/api/v1/dashboard/layouts', {
      name: 'Temporary',
      widgets: [],
    }).expect(201)
    await send(
      agent,
      csrfToken,
      'delete',
      `/api/v1/dashboard/layouts/${disposable.body.data.layout.id}`,
      { expectedVersion: 0 },
    ).expect(200)
  })

  it('isolates layouts owned by another account', async () => {
    const { agent, csrfToken } = await signedIn()
    const foreign = await foreignUser()
    const foreignLayout = await DashboardLayout.create({
      userId: foreign._id,
      name: 'Foreign layout',
      isDefault: false,
      widgets: [],
      version: 0,
    })

    expect((await agent.get(`/api/v1/dashboard/data?layoutId=${foreignLayout.id}`)).status).toBe(
      404,
    )
    expect(
      (
        await send(agent, csrfToken, 'patch', `/api/v1/dashboard/layouts/${foreignLayout.id}`, {
          name: 'Hijacked',
          expectedVersion: 0,
        })
      ).status,
    ).toBe(404)
    expect(
      (
        await send(agent, csrfToken, 'delete', `/api/v1/dashboard/layouts/${foreignLayout.id}`, {
          expectedVersion: 0,
        })
      ).status,
    ).toBe(404)
  })

  it('resolves dashboard widgets without exposing journal content', async () => {
    const secret = 'TOP_SECRET_JOURNAL_CONTENT_7'
    const { agent, csrfToken } = await signedIn()
    await seedActivity(agent, csrfToken, secret)
    await send(agent, csrfToken, 'patch', '/api/v1/settings', {
      calendarJournalIndicator: true,
    }).expect(200)

    const response = await agent.get('/api/v1/dashboard/data').expect(200)
    const { layout, widgets } = response.body.data
    expect(layout.isDefault).toBe(true)
    expect(widgets.map((widget) => widget.id)).toEqual([
      'trades_summary',
      'study_summary',
      'calendar_activity',
      'goals_progress',
    ])

    const trades = widgets.find((widget) => widget.id === 'trades_summary')
    expect(trades.data.summary.tradeCount).toBe(1)
    expect(trades.data.summary.totalPnlMicros).not.toBe(null)

    const study = widgets.find((widget) => widget.id === 'study_summary')
    expect(study.data.summary.todayMinutes).toBe(45)
    expect(study.data.summary.dailyTargetMinutes).toBe(60)

    const goals = widgets.find((widget) => widget.id === 'goals_progress')
    expect(goals.data.goals).toHaveLength(1)
    expect(goals.data.goals[0].title).toBe('Complete the React course')

    const activity = widgets.find((widget) => widget.id === 'calendar_activity')
    const expectedFrom = new Date(`${today}T00:00:00Z`)
    expectedFrom.setUTCDate(expectedFrom.getUTCDate() - 364)
    expect(activity.size).toBe('large')
    expect(activity.data.from).toBe(expectedFrom.toISOString().slice(0, 10))
    expect(activity.data.to).toBe(today)
    expect(activity.data.days).toHaveLength(365)
    expect(activity.data.summary).toMatchObject({
      activeDays: 1,
      tradeDays: 1,
      studyDays: 1,
      tradeCount: 1,
      studyMinutes: 45,
      studyRecordCount: 1,
    })
    expect(activity.data.days.find((day) => day.date === today)).toMatchObject({
      tradeCount: 1,
      studyMinutes: 45,
    })

    const serialized = JSON.stringify(response.body.data)
    expect(serialized).not.toContain(secret)
    expect(serialized).not.toContain('Private gratitude')
  })

  it('renders the activity calendar full width even when a saved layout says medium', async () => {
    const { agent, csrfToken } = await signedIn()
    const created = await send(agent, csrfToken, 'post', '/api/v1/dashboard/layouts', {
      name: 'Legacy sizing',
      isDefault: true,
      widgets: [
        {
          id: 'calendar_activity',
          visible: true,
          size: 'medium',
          position: 0,
          settings: {},
        },
      ],
    }).expect(201)

    const response = await agent
      .get(`/api/v1/dashboard/data?layoutId=${created.body.data.layout.id}`)
      .expect(200)
    const activity = response.body.data.widgets[0]
    expect(activity).toMatchObject({ id: 'calendar_activity', size: 'large' })
    expect(activity.data.days).toHaveLength(365)
  })

  it('aggregates calendar days and returns only a neutral journal marker', async () => {
    const secret = 'CALENDAR_JOURNAL_SECRET_7'
    const { agent, csrfToken } = await signedIn()
    await seedActivity(agent, csrfToken, secret)

    const before = await agent.get(`/api/v1/calendar/month?month=${month}`).expect(200)
    const dayBefore = before.body.data.days.find((day) => day.date === today)
    expect(dayBefore).toMatchObject({ tradeCount: 1, studyMinutes: 45, studyRecordCount: 1 })
    expect(dayBefore.hasJournalEntry).toBeUndefined()

    await send(agent, csrfToken, 'patch', '/api/v1/settings', {
      calendarJournalIndicator: true,
    }).expect(200)

    const after = await agent.get(`/api/v1/calendar/month?month=${month}`).expect(200)
    const day = after.body.data.days.find((entry) => entry.date === today)
    expect(after.body.data.journalIndicatorEnabled).toBe(true)
    expect(day.hasJournalEntry).toBe(true)
    expect(day.netPnlMicros).not.toBe(null)
    expect(day).not.toHaveProperty('highlights')
    expect(day).not.toHaveProperty('notes')

    const serialized = JSON.stringify(after.body.data)
    expect(serialized).not.toContain(secret)
    expect(serialized).not.toContain('Private gratitude')
  })

  it('does not mark journal entries that belong to another owner', async () => {
    const secret = 'FOREIGN_JOURNAL_SECRET_7'
    const { agent, csrfToken } = await signedIn()
    await send(agent, csrfToken, 'patch', '/api/v1/settings', {
      calendarJournalIndicator: true,
    }).expect(200)

    const foreign = await foreignUser()
    await JournalEntry.create({
      userId: foreign._id,
      date: today,
      freeWriting: secret,
      gratitude: [],
    })

    const response = await agent.get(`/api/v1/calendar/month?month=${month}`).expect(200)
    const day = response.body.data.days.find((entry) => entry.date === today)
    expect(day.hasJournalEntry).toBe(false)
    expect(JSON.stringify(response.body.data)).not.toContain(secret)
  })

  it('keeps net P&L unavailable for empty days', async () => {
    const { agent } = await signedIn()
    const response = await agent.get(`/api/v1/calendar/month?month=${month}`).expect(200)
    const day = response.body.data.days.find((entry) => entry.tradeCount === 0)
    expect(day.netPnlMicros).toBe(null)
  })
})
