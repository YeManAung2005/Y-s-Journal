// @vitest-environment node

import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PosterConfig } from '../../src/server/models/poster-config.js'
import { User } from '../../src/server/models/user.js'
import { todayInTimeZone } from '../../src/server/lib/timezone.js'
import { connectTestDb, disconnectTestDb, resetTestDb } from '../helpers/test-db.js'
import { buildTestApp, getCsrfToken, setupOwner } from '../helpers/test-app.js'

describe('Phase 8 Poster Studio API', () => {
  let app
  const today = todayInTimeZone()

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
      email: 'foreign-poster@example.com',
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

    await send(agent, csrfToken, 'patch', '/api/v1/settings', {
      dailyStudyTargetMinutes: 30,
    }).expect(200)

    await send(agent, csrfToken, 'post', '/api/v1/journal/entries', {
      date: today,
      freeWriting: journalContent,
      gratitude: ['Private gratitude'],
    }).expect(201)
  }

  it('requires authentication and validates poster requests', async () => {
    expect((await request(app).get('/api/v1/posters/catalog')).status).toBe(401)
    expect((await request(app).get('/api/v1/posters/data?type=trading')).status).toBe(401)
    expect((await request(app).get('/api/v1/posters/configs')).status).toBe(401)

    const { agent } = await signedIn()
    expect((await agent.get('/api/v1/posters/data?type=journal')).status).toBe(400)
    expect((await agent.get('/api/v1/posters/data?type=trading&days=3')).status).toBe(400)

    const missingCsrf = await agent.post('/api/v1/posters/configs').send({
      name: 'Focus poster',
      type: 'trading',
    })
    expect(missingCsrf.status).toBe(403)
    expect(missingCsrf.body.error.code).toBe('CSRF_INVALID')
  })

  it('returns a template catalog with allowlisted poster metadata', async () => {
    const { agent } = await signedIn()
    const response = await agent.get('/api/v1/posters/catalog').expect(200)

    expect(response.body.data.types.map((type) => type.id)).toEqual([
      'trading',
      'learning',
      'trade',
    ])
    expect(response.body.data.templates.map((template) => template.id)).toEqual([
      'midnight',
      'paper',
      'ember',
    ])
    expect(response.body.data.dimensions).toEqual([
      { id: 'square', label: 'Square', width: 1080, height: 1080 },
      { id: 'portrait', label: 'Portrait', width: 1080, height: 1350 },
      { id: 'story', label: 'Story', width: 1080, height: 1920 },
    ])
    expect(response.body.data.defaults).toMatchObject({
      type: 'trading',
      template: 'midnight',
      dimension: 'square',
      days: 30,
      basis: 'gross',
    })
  })

  it('creates, updates, lists, and deletes owner poster configs with version checks', async () => {
    const { agent, csrfToken } = await signedIn()

    const created = await send(agent, csrfToken, 'post', '/api/v1/posters/configs', {
      name: 'Focus poster',
      type: 'trading',
      template: 'paper',
      dimension: 'portrait',
      accentColor: '#22c55e',
      headline: 'Discipline pays',
      subtitle: 'A focused month',
      footer: 'Private review',
      logoPosition: 'top-right',
      days: 14,
      basis: 'net',
    }).expect(201)

    const config = created.body.data.config
    expect(config).toMatchObject({
      name: 'Focus poster',
      type: 'trading',
      template: 'paper',
      dimension: 'portrait',
      accentColor: '#22c55e',
      headline: 'Discipline pays',
      logoPosition: 'top-right',
      days: 14,
      basis: 'net',
      version: 0,
    })

    const duplicate = await send(agent, csrfToken, 'post', '/api/v1/posters/configs', {
      name: 'Focus poster',
      type: 'learning',
    })
    expect(duplicate.status).toBe(409)
    expect(duplicate.body.error.code).toBe('CONFLICT')

    const list = await agent.get('/api/v1/posters/configs').expect(200)
    expect(list.body.data.configs).toHaveLength(1)
    expect(list.body.data.configs[0].id).toBe(config.id)

    const updated = await send(agent, csrfToken, 'patch', `/api/v1/posters/configs/${config.id}`, {
      name: 'Deep focus poster',
      accentColor: '#f97316',
      expectedVersion: 0,
    }).expect(200)
    expect(updated.body.data.config).toMatchObject({
      name: 'Deep focus poster',
      accentColor: '#f97316',
      version: 1,
    })

    const stalePatch = await send(
      agent,
      csrfToken,
      'patch',
      `/api/v1/posters/configs/${config.id}`,
      { name: 'Stale poster', expectedVersion: 0 },
    )
    expect(stalePatch.status).toBe(409)
    expect(stalePatch.body.error.code).toBe('VERSION_CONFLICT')

    const staleDelete = await send(
      agent,
      csrfToken,
      'delete',
      `/api/v1/posters/configs/${config.id}`,
      { expectedVersion: 0 },
    )
    expect(staleDelete.status).toBe(409)

    await send(agent, csrfToken, 'delete', `/api/v1/posters/configs/${config.id}`, {
      expectedVersion: 1,
    }).expect(200)

    const empty = await agent.get('/api/v1/posters/configs').expect(200)
    expect(empty.body.data.configs).toHaveLength(0)
  })

  it('isolates poster configs owned by another account', async () => {
    const { agent, csrfToken } = await signedIn()
    const foreign = await foreignUser()
    const foreignConfig = await PosterConfig.create({
      userId: foreign._id,
      name: 'Foreign poster',
      type: 'learning',
    })

    const list = await agent.get('/api/v1/posters/configs').expect(200)
    expect(list.body.data.configs).toHaveLength(0)

    expect(
      (
        await send(agent, csrfToken, 'patch', `/api/v1/posters/configs/${foreignConfig.id}`, {
          name: 'Hijacked',
          expectedVersion: 0,
        })
      ).status,
    ).toBe(404)
    expect(
      (
        await send(agent, csrfToken, 'delete', `/api/v1/posters/configs/${foreignConfig.id}`, {
          expectedVersion: 0,
        })
      ).status,
    ).toBe(404)
  })

  it('returns allowlisted trading and learning data without journal content', async () => {
    const secret = 'POSTER_JOURNAL_SECRET_8'
    const { agent, csrfToken } = await signedIn()
    await seedActivity(agent, csrfToken, secret)

    const trading = await agent
      .get('/api/v1/posters/data?type=trading&days=30&basis=gross')
      .expect(200)
    expect(trading.body.data).toMatchObject({
      type: 'trading',
      to: today,
      days: 30,
      basis: 'gross',
      title: 'Trading performance',
    })
    expect(trading.body.data.metrics).toHaveLength(4)
    expect(trading.body.data.metrics.find((metric) => metric.id === 'trades').value).toBe(1)
    expect(trading.body.data.metrics.find((metric) => metric.id === 'pnl').value).not.toBe(null)

    const learning = await agent.get('/api/v1/posters/data?type=learning&days=30').expect(200)
    expect(learning.body.data).toMatchObject({
      type: 'learning',
      to: today,
      days: 30,
      title: 'Study momentum',
    })
    expect(learning.body.data.metrics.find((metric) => metric.id === 'minutes').value).toBe(45)
    expect(learning.body.data.metrics.find((metric) => metric.id === 'activeDays').value).toBe(1)
    expect(learning.body.data.metrics.find((metric) => metric.id === 'currentStreak').value).toBe(1)

    const serialized = JSON.stringify({
      trading: trading.body.data,
      learning: learning.body.data,
    })
    expect(serialized).not.toContain(secret)
    expect(serialized).not.toContain('Private gratitude')
  })

  it('builds a single-trade ROI poster from allowlisted trade fields', async () => {
    const { agent, csrfToken } = await signedIn()
    const reference = await agent.get('/api/v1/reference').expect(200)
    const account = reference.body.data.accounts[0]
    const instrument = reference.body.data.instruments.find((item) => item.symbol === 'NQ')

    const created = await send(agent, csrfToken, 'post', '/api/v1/trades', {
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
      notes: 'PRIVATE_TRADE_NOTE_8',
      lessons: 'PRIVATE_TRADE_LESSON_8',
    }).expect(201)
    const trade = created.body.data.trade

    const gross = await agent
      .get(`/api/v1/posters/data?type=trade&tradeId=${trade.id}&basis=gross`)
      .expect(200)
    expect(gross.body.data).toMatchObject({
      type: 'trade',
      from: today,
      to: today,
      days: 1,
      basis: 'gross',
      title: 'NQ Long',
    })
    expect(gross.body.data.subtitle).toContain('Entry 25000')
    expect(gross.body.data.trade).toMatchObject({
      id: trade.id,
      symbol: 'NQ',
      direction: 'long',
      entryPrice: '25000',
      exitPrice: '25010',
      quantity: '1',
    })

    const grossMetrics = Object.fromEntries(
      gross.body.data.metrics.map((metric) => [metric.id, metric]),
    )
    expect(grossMetrics.roi.value).toBe('1')
    expect(grossMetrics.pnl.value).toBe(200_000_000)
    expect(grossMetrics.r.value).toBe('1')
    expect(grossMetrics.risk.value).toBe(200_000_000)
    expect(gross.body.data.note).toBe(null)

    const net = await agent
      .get(`/api/v1/posters/data?type=trade&tradeId=${trade.id}&basis=net`)
      .expect(200)
    const netMetrics = Object.fromEntries(
      net.body.data.metrics.map((metric) => [metric.id, metric]),
    )
    expect(netMetrics.roi.value).toBe('0.975')
    expect(netMetrics.pnl.value).toBe(195_000_000)

    const config = await send(agent, csrfToken, 'post', '/api/v1/posters/configs', {
      name: 'Trade ROI poster',
      type: 'trade',
      tradeId: trade.id,
      basis: 'net',
    }).expect(201)
    expect(config.body.data.config).toMatchObject({
      type: 'trade',
      tradeId: trade.id,
      basis: 'net',
    })

    const serialized = JSON.stringify(gross.body.data)
    expect(serialized).not.toContain('PRIVATE_TRADE_NOTE_8')
    expect(serialized).not.toContain('PRIVATE_TRADE_LESSON_8')
  })

  it('rejects trade posters for unknown trades and missing trade IDs', async () => {
    const { agent, csrfToken } = await signedIn()
    const unknown = '64b7f9c2a1d3e4f5a6b7c8d9'

    expect((await agent.get(`/api/v1/posters/data?type=trade&tradeId=${unknown}`)).status).toBe(404)

    const missing = await send(agent, csrfToken, 'post', '/api/v1/posters/configs', {
      name: 'Missing trade',
      type: 'trade',
    })
    expect(missing.status).toBe(400)
    expect(missing.body.error.code).toBe('VALIDATION_ERROR')

    const unknownConfig = await send(agent, csrfToken, 'post', '/api/v1/posters/configs', {
      name: 'Unknown trade',
      type: 'trade',
      tradeId: unknown,
    })
    expect(unknownConfig.status).toBe(400)
    expect(unknownConfig.body.error.code).toBe('VALIDATION_ERROR')
  })
})
