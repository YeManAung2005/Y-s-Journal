// @vitest-environment node

import { rm } from 'node:fs/promises'
import request from 'supertest'
import sharp from 'sharp'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectTestDb, disconnectTestDb, resetTestDb } from '../helpers/test-db.js'
import { buildTestApp, getCsrfToken, setupOwner, testStorageDir } from '../helpers/test-app.js'

describe('Phase 3 trading journal API', () => {
  let app

  beforeAll(async () => {
    await rm(testStorageDir, { recursive: true, force: true })
    await connectTestDb()
  })

  beforeEach(async () => {
    await resetTestDb()
    app = buildTestApp()
  })

  afterAll(async () => {
    await disconnectTestDb()
    await rm(testStorageDir, { recursive: true, force: true })
  })

  async function signedIn() {
    const agent = request.agent(app)
    await setupOwner(agent)
    return { agent, csrfToken: await getCsrfToken(agent) }
  }

  async function referenceIds(agent) {
    const response = await agent.get('/api/v1/reference').expect(200)
    return {
      account: response.body.data.accounts[0],
      instrument: response.body.data.instruments.find((item) => item.symbol === 'NQ'),
    }
  }

  async function createExtras(agent, csrfToken) {
    const session = await agent
      .post('/api/v1/reference/trading-sessions')
      .set('x-csrf-token', csrfToken)
      .send({ name: 'New York', color: '#3b82f6', displayOrder: 1 })
      .expect(201)
    const tag = await agent
      .post('/api/v1/reference/tags')
      .set('x-csrf-token', csrfToken)
      .send({ type: 'setup', name: 'Opening Breakout', color: '#22c55e' })
      .expect(201)
    const checklist = await agent
      .post('/api/v1/reference/checklist')
      .set('x-csrf-token', csrfToken)
      .send({ text: 'Confirm initial risk', sortOrder: 0 })
      .expect(201)

    return {
      session: session.body.data.tradingSession,
      tag: tag.body.data.tag,
      checklist: checklist.body.data.checklistItem,
    }
  }

  function tradePayload(reference, overrides = {}) {
    return {
      accountId: reference.account.id,
      instrumentId: reference.instrument.id,
      tradeDate: '2026-11-24',
      direction: 'long',
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
      ...overrides,
    }
  }

  it('requires authentication and CSRF for trade writes', async () => {
    const unauthenticated = await request(app).get('/api/v1/trades')
    expect(unauthenticated.status).toBe(401)

    const { agent } = await signedIn()
    const reference = await referenceIds(agent)
    const missingCsrf = await agent.post('/api/v1/trades').send(tradePayload(reference))
    expect(missingCsrf.status).toBe(403)
    expect(missingCsrf.body.error.code).toBe('CSRF_INVALID')
  })

  it('rejects malformed trade IDs before database access', async () => {
    const { agent } = await signedIn()
    const response = await agent.get('/api/v1/trades/not-an-id')

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('creates a trade with authoritative calculations and immutable snapshots', async () => {
    const { agent, csrfToken } = await signedIn()
    const reference = await referenceIds(agent)
    const extras = await createExtras(agent, csrfToken)

    const response = await agent
      .post('/api/v1/trades')
      .set('x-csrf-token', csrfToken)
      .send(
        tradePayload(reference, {
          sessionId: extras.session.id,
          tagIds: [extras.tag.id],
          checklist: [{ itemId: extras.checklist.id, checked: true }],
          emotions: ['focused'],
          ruleViolations: ['Moved stop'],
          notes: 'Clean execution',
          lessons: 'Trust the plan',
          review: {
            followedPlan: 'partial',
            whatWentWell: 'Waited for confirmation',
            whatToImprove: 'Size earlier',
            confidence: 4,
            reviewedAt: '2026-11-24',
          },
        }),
      )
      .expect(201)

    const trade = response.body.data.trade
    expect(trade).toMatchObject({
      grossPnlMicros: 2_200_000_000,
      netPnlMicros: 2_185_000_000,
      outcomeGross: 'win',
      outcomeNet: 'win',
      automaticRiskMicros: 600_000_000,
      selectedRiskMicros: 600_000_000,
      formulaVersion: '2026-11-24.1',
      version: 0,
    })
    expect(Number(trade.grossR)).toBeCloseTo(3.6666666667, 9)
    expect(trade.exits.reduce((sum, exit) => sum + exit.allocatedFeeMicros, 0)).toBe(15_000_000)
    expect(trade.instrumentSnapshot.symbol).toBe('NQ')
    expect(trade.accountSnapshot.name).toBe('Main Account')
    expect(trade.sessionSnapshot.name).toBe('New York')
    expect(trade.tags[0].name).toBe('Opening Breakout')
    expect(trade.checklist[0]).toMatchObject({ text: 'Confirm initial risk', checked: true })
    expect(trade.emotions).toEqual(['focused'])
    expect(trade.review.followedPlan).toBe('partial')
  })

  it('keeps net values unavailable when fees are missing', async () => {
    const { agent, csrfToken } = await signedIn()
    const reference = await referenceIds(agent)

    const response = await agent
      .post('/api/v1/trades')
      .set('x-csrf-token', csrfToken)
      .send(tradePayload(reference, { fees: null }))
      .expect(201)

    expect(response.body.data.trade.feesMicros).toBeNull()
    expect(response.body.data.trade.netPnlMicros).toBeNull()
    expect(response.body.data.trade.outcomeNet).toBeNull()
    expect(response.body.data.trade.exits[0].allocatedFeeMicros).toBeNull()
  })

  it('does not default an omitted fee field to zero', async () => {
    const { agent, csrfToken } = await signedIn()
    const reference = await referenceIds(agent)
    const payload = tradePayload(reference)
    delete payload.fees

    const response = await agent
      .post('/api/v1/trades')
      .set('x-csrf-token', csrfToken)
      .send(payload)
      .expect(201)

    expect(response.body.data.trade.feesMicros).toBeNull()
    expect(response.body.data.trade.netPnlMicros).toBeNull()
    expect(response.body.data.trade.outcomeNet).toBeNull()
  })

  it('rejects prices that do not align to the instrument tick size', async () => {
    const { agent, csrfToken } = await signedIn()
    const reference = await referenceIds(agent)

    const response = await agent
      .post('/api/v1/trades')
      .set('x-csrf-token', csrfToken)
      .send(tradePayload(reference, { entryPrice: '25000.10' }))

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('updates trades with optimistic concurrency and recomputes values', async () => {
    const { agent, csrfToken } = await signedIn()
    const reference = await referenceIds(agent)
    const created = await agent
      .post('/api/v1/trades')
      .set('x-csrf-token', csrfToken)
      .send(tradePayload(reference))
      .expect(201)
    const trade = created.body.data.trade

    const updated = await agent
      .patch(`/api/v1/trades/${trade.id}`)
      .set('x-csrf-token', csrfToken)
      .send({ expectedVersion: 0, fees: '20.00', notes: 'Updated note' })
      .expect(200)
    expect(updated.body.data.trade).toMatchObject({
      version: 1,
      netPnlMicros: 2_180_000_000,
      notes: 'Updated note',
    })

    const stale = await agent
      .patch(`/api/v1/trades/${trade.id}`)
      .set('x-csrf-token', csrfToken)
      .send({ expectedVersion: 0, notes: 'Stale note' })
    expect(stale.status).toBe(409)
    expect(stale.body.error.code).toBe('VERSION_CONFLICT')
  })

  it('does not rewrite historical calculations when instrument configuration changes', async () => {
    const { agent, csrfToken } = await signedIn()
    const reference = await referenceIds(agent)
    const created = await agent
      .post('/api/v1/trades')
      .set('x-csrf-token', csrfToken)
      .send(tradePayload(reference))
      .expect(201)
    const trade = created.body.data.trade

    await agent
      .patch(`/api/v1/reference/instruments/${reference.instrument.id}`)
      .set('x-csrf-token', csrfToken)
      .send({
        expectedVersion: reference.instrument.version,
        pointValueMicros: 24_000_000,
        tickValueMicros: 6_000_000,
      })
      .expect(200)

    const after = await agent.get(`/api/v1/trades/${trade.id}`).expect(200)
    expect(after.body.data.trade.instrumentSnapshot.tickValueMicros).toBe(5_000_000)
    expect(after.body.data.trade.grossPnlMicros).toBe(2_200_000_000)
  })

  it('soft deletes and restores trades', async () => {
    const { agent, csrfToken } = await signedIn()
    const reference = await referenceIds(agent)
    const created = await agent
      .post('/api/v1/trades')
      .set('x-csrf-token', csrfToken)
      .send(tradePayload(reference))
      .expect(201)
    const trade = created.body.data.trade

    await agent
      .delete(`/api/v1/trades/${trade.id}`)
      .set('x-csrf-token', csrfToken)
      .send({ expectedVersion: 0 })
      .expect(200)

    const active = await agent.get('/api/v1/trades').expect(200)
    expect(active.body.data.trades).toHaveLength(0)

    const withDeleted = await agent.get('/api/v1/trades?includeDeleted=true').expect(200)
    expect(withDeleted.body.data.trades).toHaveLength(1)
    expect(withDeleted.body.data.trades[0].deletedAt).not.toBeNull()

    await agent
      .post(`/api/v1/trades/${trade.id}/restore`)
      .set('x-csrf-token', csrfToken)
      .send({ expectedVersion: 1 })
      .expect(200)
    const restored = await agent.get('/api/v1/trades').expect(200)
    expect(restored.body.data.trades).toHaveLength(1)
  })

  it('uploads, serves, and deletes private screenshots', async () => {
    const { agent, csrfToken } = await signedIn()
    const reference = await referenceIds(agent)
    const created = await agent
      .post('/api/v1/trades')
      .set('x-csrf-token', csrfToken)
      .send(tradePayload(reference))
      .expect(201)
    const tradeId = created.body.data.trade.id

    const png = await sharp({
      create: { width: 24, height: 16, channels: 3, background: { r: 12, g: 34, b: 56 } },
    })
      .png()
      .toBuffer()

    const upload = await agent
      .post(`/api/v1/trades/${tradeId}/screenshots`)
      .set('x-csrf-token', csrfToken)
      .attach('screenshots', png, { filename: 'chart.png', contentType: 'image/png' })
      .expect(201)
    const file = upload.body.data.files[0]
    expect(file).toMatchObject({
      mimeType: 'image/png',
      width: 24,
      height: 16,
      ownerType: 'Trade',
    })
    expect(file.url).toBe(`/api/v1/files/${file.id}`)

    const detail = await agent.get(`/api/v1/trades/${tradeId}`).expect(200)
    expect(detail.body.data.trade.screenshots).toHaveLength(1)

    const view = await agent.get(file.url).expect(200)
    expect(view.headers['content-type']).toContain('image/png')
    expect(view.headers['cache-control']).toBe('no-store')

    const unauthenticated = await request(app).get(file.url)
    expect(unauthenticated.status).toBe(401)

    await agent.delete(file.url).set('x-csrf-token', csrfToken).expect(200)
    await agent.get(file.url).expect(404)
  })

  it('enforces the five-screenshot limit per trade', async () => {
    const { agent, csrfToken } = await signedIn()
    const reference = await referenceIds(agent)
    const created = await agent
      .post('/api/v1/trades')
      .set('x-csrf-token', csrfToken)
      .send(tradePayload(reference))
      .expect(201)
    const tradeId = created.body.data.trade.id

    const png = await sharp({
      create: { width: 24, height: 16, channels: 3, background: { r: 12, g: 34, b: 56 } },
    })
      .png()
      .toBuffer()

    let upload = agent.post(`/api/v1/trades/${tradeId}/screenshots`).set('x-csrf-token', csrfToken)
    for (let index = 0; index < 5; index += 1) {
      upload = upload.attach('screenshots', png, {
        filename: `chart-${index}.png`,
        contentType: 'image/png',
      })
    }
    const full = await upload.expect(201)
    expect(full.body.data.files).toHaveLength(5)

    const overLimit = await agent
      .post(`/api/v1/trades/${tradeId}/screenshots`)
      .set('x-csrf-token', csrfToken)
      .attach('screenshots', png, { filename: 'chart-6.png', contentType: 'image/png' })

    expect(overLimit.status).toBe(400)
    expect(overLimit.body.error.code).toBe('FILE_LIMIT')
  })

  it('rejects files that are not valid allowed images', async () => {
    const { agent, csrfToken } = await signedIn()
    const reference = await referenceIds(agent)
    const created = await agent
      .post('/api/v1/trades')
      .set('x-csrf-token', csrfToken)
      .send(tradePayload(reference))
      .expect(201)

    const response = await agent
      .post(`/api/v1/trades/${created.body.data.trade.id}/screenshots`)
      .set('x-csrf-token', csrfToken)
      .attach('screenshots', Buffer.from('not an image'), {
        filename: 'fake.png',
        contentType: 'image/png',
      })

    expect(response.status).toBe(400)
    expect(response.body.error.code).toBe('FILE_INVALID')
  })
})
