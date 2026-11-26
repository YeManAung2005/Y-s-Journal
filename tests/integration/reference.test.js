// @vitest-environment node

import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectTestDb, disconnectTestDb, resetTestDb } from '../helpers/test-db.js'
import { buildTestApp, getCsrfToken, setupOwner } from '../helpers/test-app.js'

describe('Phase 2 reference data and finance API', () => {
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

  async function signedInAgent() {
    const agent = request.agent(app)
    await setupOwner(agent)
    return { agent, csrfToken: await getCsrfToken(agent) }
  }

  it('seeds only the approved default reference data', async () => {
    const { agent } = await signedInAgent()

    const response = await agent.get('/api/v1/reference').expect(200)
    const data = response.body.data

    expect(data.instruments.map((item) => item.symbol).sort()).toEqual(
      ['ES', 'MNQ', 'NQ', 'MES'].sort(),
    )
    expect(data.instruments.every((item) => item.builtIn && item.active)).toBe(true)
    expect(data.accounts).toHaveLength(1)
    expect(data.accounts[0]).toMatchObject({
      name: 'Main Account',
      startingBalanceMicros: 0,
      startingBalance: '0',
      isDefault: true,
    })
    expect(data.tags).toEqual([])
    expect(data.tradingSessions).toEqual([])
    expect(data.checklist).toEqual([])
  })

  it('requires authentication and CSRF for reference data', async () => {
    const unauthenticated = await request(app).get('/api/v1/reference')
    expect(unauthenticated.status).toBe(401)

    const { agent } = await signedInAgent()
    const missingCsrf = await agent
      .post('/api/v1/reference/tags')
      .send({ type: 'custom', name: 'Test' })
    expect(missingCsrf.status).toBe(403)
    expect(missingCsrf.body.error.code).toBe('CSRF_INVALID')
  })

  it('creates, updates, archives, and restores tags with optimistic concurrency', async () => {
    const { agent, csrfToken } = await signedInAgent()

    const created = await agent
      .post('/api/v1/reference/tags')
      .set('x-csrf-token', csrfToken)
      .send({ type: 'setup', name: 'Breakout', color: '#22c55e' })
      .expect(201)
    const tag = created.body.data.tag
    expect(tag).toMatchObject({ slug: 'breakout', version: 0, archivedAt: null })

    const updated = await agent
      .patch(`/api/v1/reference/tags/${tag.id}`)
      .set('x-csrf-token', csrfToken)
      .send({ expectedVersion: 0, name: 'Opening Breakout' })
      .expect(200)
    expect(updated.body.data.tag).toMatchObject({
      name: 'Opening Breakout',
      slug: 'opening-breakout',
      version: 1,
    })

    const stale = await agent
      .patch(`/api/v1/reference/tags/${tag.id}`)
      .set('x-csrf-token', csrfToken)
      .send({ expectedVersion: 0, color: '#ef4444' })
    expect(stale.status).toBe(409)
    expect(stale.body.error.code).toBe('VERSION_CONFLICT')

    await agent
      .post(`/api/v1/reference/tags/${tag.id}/archive`)
      .set('x-csrf-token', csrfToken)
      .expect(200)

    const hidden = await agent.get('/api/v1/reference').expect(200)
    expect(hidden.body.data.tags).toHaveLength(0)

    const withArchived = await agent.get('/api/v1/reference?includeArchived=true').expect(200)
    expect(withArchived.body.data.tags).toHaveLength(1)
    expect(withArchived.body.data.tags[0].archivedAt).not.toBeNull()

    await agent
      .post(`/api/v1/reference/tags/${tag.id}/restore`)
      .set('x-csrf-token', csrfToken)
      .expect(200)
    const restored = await agent.get('/api/v1/reference').expect(200)
    expect(restored.body.data.tags).toHaveLength(1)
  })

  it('manages trading sessions and checklist items', async () => {
    const { agent, csrfToken } = await signedInAgent()

    const session = await agent
      .post('/api/v1/reference/trading-sessions')
      .set('x-csrf-token', csrfToken)
      .send({ name: 'New York', color: '#3b82f6', displayOrder: 1 })
      .expect(201)
    expect(session.body.data.tradingSession).toMatchObject({
      slug: 'new-york',
      displayOrder: 1,
    })

    const item = await agent
      .post('/api/v1/reference/checklist')
      .set('x-csrf-token', csrfToken)
      .send({ text: 'Review the daily plan', sortOrder: 0 })
      .expect(201)
    expect(item.body.data.checklistItem.text).toBe('Review the daily plan')

    const data = (await agent.get('/api/v1/reference').expect(200)).body.data
    expect(data.tradingSessions).toHaveLength(1)
    expect(data.checklist).toHaveLength(1)
  })

  it('enforces one editable default account', async () => {
    const { agent, csrfToken } = await signedInAgent()
    const initial = (await agent.get('/api/v1/reference').expect(200)).body.data.accounts[0]

    const second = await agent
      .post('/api/v1/reference/accounts')
      .set('x-csrf-token', csrfToken)
      .send({
        name: 'Practice',
        broker: 'Local',
        accountType: 'demo',
        startingBalance: '1000.00',
        isDefault: true,
      })
      .expect(201)
    expect(second.body.data.account).toMatchObject({
      startingBalanceMicros: 1_000_000_000,
      isDefault: true,
    })

    const refreshed = (await agent.get('/api/v1/reference').expect(200)).body.data.accounts
    expect(refreshed.find((account) => account.id === initial.id).isDefault).toBe(false)

    const blocked = await agent
      .post(`/api/v1/reference/accounts/${second.body.data.account.id}/archive`)
      .set('x-csrf-token', csrfToken)
    expect(blocked.status).toBe(409)
    expect(blocked.body.error.code).toBe('DEFAULT_ACCOUNT')

    await agent
      .post(`/api/v1/reference/accounts/${initial.id}/set-default`)
      .set('x-csrf-token', csrfToken)
      .expect(200)
    await agent
      .post(`/api/v1/reference/accounts/${second.body.data.account.id}/archive`)
      .set('x-csrf-token', csrfToken)
      .expect(200)
  })

  it('allows built-in instrument specifications to be configured but not duplicated', async () => {
    const { agent, csrfToken } = await signedInAgent()
    const data = (await agent.get('/api/v1/reference').expect(200)).body.data
    const nq = data.instruments.find((instrument) => instrument.symbol === 'NQ')

    const updated = await agent
      .patch(`/api/v1/reference/instruments/${nq.id}`)
      .set('x-csrf-token', csrfToken)
      .send({
        expectedVersion: nq.version,
        name: 'Nasdaq 100 configured',
        tickValueMicros: 5_000_000,
      })
      .expect(200)
    expect(updated.body.data.instrument.name).toBe('Nasdaq 100 configured')

    const duplicate = await agent
      .post('/api/v1/reference/instruments')
      .set('x-csrf-token', csrfToken)
      .send({
        symbol: 'NQ',
        name: 'Duplicate',
        pointValueMicros: 20_000_000,
        tickValueMicros: 5_000_000,
        tickSizeMicros: 250_000,
      })
    expect(duplicate.status).toBe(409)

    const invalidSpec = await agent
      .post('/api/v1/reference/instruments')
      .set('x-csrf-token', csrfToken)
      .send({
        symbol: 'BAD',
        name: 'Bad spec',
        pointValueMicros: 20_000_000,
        tickValueMicros: 5_000_000,
        tickSizeMicros: 500_000,
      })
    expect(invalidSpec.status).toBe(400)
    expect(invalidSpec.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('exposes the server-authoritative calculator', async () => {
    const { agent, csrfToken } = await signedInAgent()

    const response = await agent
      .post('/api/v1/finance/calculate')
      .set('x-csrf-token', csrfToken)
      .send({
        direction: 'long',
        instrument: {
          pointValueMicros: 20_000_000,
          tickValueMicros: 5_000_000,
          tickSizeMicros: 250_000,
        },
        entryPrice: '25000.00',
        quantity: '3.00',
        exits: [
          { price: '25020.00', quantity: '1.00' },
          { price: '25040.00', quantity: '1.00' },
          { price: '25050.00', quantity: '1.00' },
        ],
        fees: '15.00',
        initialStopPrice: '24990.00',
        manualRisk: null,
      })
      .expect(200)

    expect(response.body.data.calculation).toMatchObject({
      grossPnlMicros: 2_200_000_000,
      netPnlMicros: 2_185_000_000,
      outcomeGross: 'win',
      outcomeNet: 'win',
      automaticRiskMicros: 600_000_000,
    })

    const missingCsrf = await agent.post('/api/v1/finance/calculate').send({})
    expect(missingCsrf.status).toBe(403)
  })
})
