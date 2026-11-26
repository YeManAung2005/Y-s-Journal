// @vitest-environment node

import mongoose from 'mongoose'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectTestDb, disconnectTestDb, resetTestDb } from '../helpers/test-db.js'
import { buildTestApp, getCsrfToken, setupOwner } from '../helpers/test-app.js'
import { Trade } from '../../src/server/models/trade.js'
import { User } from '../../src/server/models/user.js'

describe('Phase 4 trading analytics API', () => {
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
    const user = await setupOwner(agent)
    return { agent, csrfToken: await getCsrfToken(agent), user }
  }

  async function referenceIds(agent) {
    const response = await agent.get('/api/v1/reference').expect(200)
    return {
      account: response.body.data.accounts[0],
      instrument: response.body.data.instruments.find((item) => item.symbol === 'NQ'),
    }
  }

  async function seedTrades(agent, csrfToken) {
    const reference = await referenceIds(agent)

    const newYork = await agent
      .post('/api/v1/reference/trading-sessions')
      .set('x-csrf-token', csrfToken)
      .send({ name: 'New York', color: '#3b82f6', displayOrder: 1 })
      .expect(201)
    const london = await agent
      .post('/api/v1/reference/trading-sessions')
      .set('x-csrf-token', csrfToken)
      .send({ name: 'London', color: '#22c55e', displayOrder: 2 })
      .expect(201)
    const breakout = await agent
      .post('/api/v1/reference/tags')
      .set('x-csrf-token', csrfToken)
      .send({ type: 'setup', name: 'Breakout', color: '#22c55e' })
      .expect(201)

    const base = {
      accountId: reference.account.id,
      instrumentId: reference.instrument.id,
      direction: 'long',
      entryPrice: '25000.00',
      quantity: '1.00',
      initialStopPrice: '24990.00',
      manualRisk: null,
    }

    const trades = [
      {
        ...base,
        tradeDate: '2026-10-15',
        exits: [{ price: '25010.00', quantity: '1.00' }],
        fees: '5.00',
        sessionId: newYork.body.data.tradingSession.id,
        tagIds: [breakout.body.data.tag.id],
      },
      {
        ...base,
        quantity: '2.00',
        tradeDate: '2026-11-01',
        exits: [{ price: '25020.00', quantity: '2.00' }],
        fees: '10.00',
        sessionId: newYork.body.data.tradingSession.id,
        tagIds: [breakout.body.data.tag.id],
      },
      {
        ...base,
        direction: 'short',
        initialStopPrice: '25010.00',
        tradeDate: '2026-11-02',
        exits: [{ price: '25040.00', quantity: '1.00' }],
        fees: '5.00',
        manualRisk: '1000.00',
        sessionId: newYork.body.data.tradingSession.id,
      },
      {
        ...base,
        tradeDate: '2026-11-03',
        exits: [{ price: '25000.00', quantity: '1.00' }],
        fees: '2.00',
        sessionId: london.body.data.tradingSession.id,
      },
      {
        ...base,
        tradeDate: '2026-11-04',
        exits: [{ price: '25010.00', quantity: '1.00' }],
        fees: null,
        sessionId: london.body.data.tradingSession.id,
      },
    ]

    for (const trade of trades) {
      await agent.post('/api/v1/trades').set('x-csrf-token', csrfToken).send(trade).expect(201)
    }

    return {
      reference,
      newYork: newYork.body.data.tradingSession,
      london: london.body.data.tradingSession,
      breakout: breakout.body.data.tag,
    }
  }

  it('requires authentication and rejects invalid analytics queries', async () => {
    expect((await request(app).get('/api/v1/analytics/summary')).status).toBe(401)

    const { agent } = await signedIn()
    const invalidBasis = await agent.get('/api/v1/analytics/summary?basis=total')
    expect(invalidBasis.status).toBe(400)
    expect(invalidBasis.body.error.code).toBe('VALIDATION_ERROR')

    const missingComparison = await agent.get(
      '/api/v1/analytics/compare?from=2026-11-01&to=2026-11-02',
    )
    expect(missingComparison.status).toBe(400)

    const missingDimension = await agent.get('/api/v1/analytics/breakdowns')
    expect(missingDimension.status).toBe(400)
  })

  it('calculates net summary metrics with approved formulas', async () => {
    const { agent, csrfToken } = await signedIn()
    await seedTrades(agent, csrfToken)

    const response = await agent
      .get('/api/v1/analytics/summary?from=2026-11-01&to=2026-11-03&basis=net')
      .expect(200)
    const summary = response.body.data.summary

    expect(summary).toMatchObject({
      tradeCount: 3,
      totalPnlMicros: -17_000_000,
      netPnlMicros: -17_000_000,
      wins: 1,
      losses: 2,
      breakEvens: 0,
      averageWinMicros: 790_000_000,
      averageLossMicros: 403_500_000,
      maxDrawdownMicros: 807_000_000,
      winningDays: 1,
      losingDays: 2,
    })
    expect(Number(summary.winRate)).toBeCloseTo(1 / 3, 9)
    expect(Number(summary.profitFactor)).toBeCloseTo(790 / 807, 8)
    expect(Number(summary.averageR)).toBeCloseTo(0.4, 9)
    expect(summary.streaks).toMatchObject({
      currentWinningStreak: 0,
      currentLosingStreak: 2,
      longestWinningStreak: 1,
      longestLosingStreak: 2,
    })
    expect(summary.coverage).toMatchObject({
      netComplete: true,
      rComplete: true,
      missingNetCount: 0,
      missingRiskCount: 0,
    })
  })

  it('calculates gross metrics and keeps net aggregates unavailable when fees are missing', async () => {
    const { agent, csrfToken } = await signedIn()
    await seedTrades(agent, csrfToken)

    const gross = await agent
      .get('/api/v1/analytics/summary?from=2026-11-01&to=2026-11-04&basis=gross')
      .expect(200)
    expect(gross.body.data.summary).toMatchObject({
      tradeCount: 4,
      totalPnlMicros: 200_000_000,
      wins: 2,
      losses: 1,
      breakEvens: 1,
      averageWinMicros: 500_000_000,
      averageLossMicros: 800_000_000,
      profitFactor: '1.25',
      maxDrawdownMicros: 800_000_000,
    })
    expect(Number(gross.body.data.summary.averageR)).toBeCloseTo(0.55, 9)
    expect(gross.body.data.summary.streaks.currentWinningStreak).toBe(1)

    const net = await agent
      .get('/api/v1/analytics/summary?from=2026-11-01&to=2026-11-04&basis=net')
      .expect(200)
    expect(net.body.data.summary).toMatchObject({
      tradeCount: 4,
      grossPnlMicros: 200_000_000,
      totalPnlMicros: null,
      netPnlMicros: null,
      wins: null,
      losses: null,
      profitFactor: null,
      maxDrawdownMicros: null,
      coverage: { netAvailable: 3, missingNetCount: 1 },
    })
  })

  it('applies owner-scoped filters for account, instrument, session, tag, direction, and outcome', async () => {
    const { agent, csrfToken, user } = await signedIn()
    const { reference, breakout, newYork } = await seedTrades(agent, csrfToken)

    const foreign = await User.create({
      email: 'other@example.com',
      passwordHash: 'unused-test-hash',
      displayName: 'Other',
    })
    const ownedTrade = await Trade.findOne({ userId: user.id, tradeDate: '2026-11-01' }).lean()
    await Trade.create({
      ...ownedTrade,
      _id: new mongoose.Types.ObjectId(),
      userId: foreign._id,
    })

    const cases = [
      [`accountId=${reference.account.id}`, 5],
      [`instrumentId=${reference.instrument.id}`, 5],
      [`tagId=${breakout.id}`, 2],
      [`sessionId=${newYork.id}`, 3],
      ['direction=short', 1],
      ['accountId=000000000000000000000000', 0],
    ]

    for (const [query, expected] of cases) {
      const response = await agent.get(`/api/v1/analytics/summary?${query}&basis=gross`).expect(200)
      expect(response.body.data.summary.tradeCount, query).toBe(expected)
    }

    const outcome = await agent
      .get('/api/v1/analytics/summary?from=2026-11-01&to=2026-11-03&basis=net&outcome=win')
      .expect(200)
    expect(outcome.body.data.summary.tradeCount).toBe(1)
    expect(outcome.body.data.summary.totalPnlMicros).toBe(790_000_000)
  })

  it('groups breakdowns by session while preserving missing-fee unavailability', async () => {
    const { agent, csrfToken } = await signedIn()
    await seedTrades(agent, csrfToken)

    const response = await agent
      .get('/api/v1/analytics/breakdowns?dimension=session&basis=net&from=2026-11-01&to=2026-11-04')
      .expect(200)
    const breakdowns = response.body.data.breakdowns

    expect(breakdowns.map((item) => item.label)).toEqual(['London', 'New York'])
    const newYork = breakdowns.find((item) => item.label === 'New York')
    const london = breakdowns.find((item) => item.label === 'London')
    expect(newYork.summary).toMatchObject({
      tradeCount: 2,
      totalPnlMicros: -15_000_000,
      wins: 1,
      losses: 1,
    })
    expect(london.summary).toMatchObject({
      tradeCount: 2,
      totalPnlMicros: null,
      coverage: { missingNetCount: 1 },
    })
  })

  it('emits one equity point per trade even when trades share a date', async () => {
    const { agent, csrfToken } = await signedIn()
    const reference = await referenceIds(agent)
    const base = {
      accountId: reference.account.id,
      instrumentId: reference.instrument.id,
      tradeDate: '2026-11-10',
      direction: 'long',
      entryPrice: '25000.00',
      quantity: '1.00',
      initialStopPrice: '24990.00',
      manualRisk: null,
    }

    for (const trade of [
      { ...base, exits: [{ price: '25010.00', quantity: '1.00' }], fees: '5.00' },
      { ...base, exits: [{ price: '24990.00', quantity: '1.00' }], fees: '5.00' },
    ]) {
      await agent.post('/api/v1/trades').set('x-csrf-token', csrfToken).send(trade).expect(201)
    }

    const response = await agent
      .get('/api/v1/analytics/equity?from=2026-11-10&to=2026-11-10')
      .expect(200)
    const tradePoints = response.body.data.equity.points.filter((point) => point.kind === 'trade')

    expect(tradePoints).toHaveLength(2)
    expect(tradePoints.map((point) => point.cumulativeNetPnlMicros)).toEqual([
      195_000_000, -10_000_000,
    ])
  })

  it('builds equity and account balance curves from trades and adjustments', async () => {
    const { agent, csrfToken } = await signedIn()
    const { reference } = await seedTrades(agent, csrfToken)

    const adjustments = [
      {
        accountId: reference.account.id,
        type: 'deposit',
        amount: '1000.00',
        date: '2026-11-01',
        note: 'Transfer in',
      },
      {
        accountId: reference.account.id,
        type: 'withdrawal',
        amount: '200.00',
        date: '2026-11-03',
        note: 'Transfer out',
      },
      {
        accountId: reference.account.id,
        type: 'correction',
        amount: '50.00',
        date: '2026-11-04',
        note: 'Fee refund',
      },
    ]
    for (const adjustment of adjustments) {
      await agent
        .post(`/api/v1/accounts/${reference.account.id}/adjustments`)
        .set('x-csrf-token', csrfToken)
        .send(adjustment)
        .expect(201)
    }

    const response = await agent
      .get(
        `/api/v1/analytics/equity?accountId=${reference.account.id}&from=2026-11-01&to=2026-11-04`,
      )
      .expect(200)
    const equity = response.body.data.equity

    expect(equity.startingBalanceMicros).toBe(0)
    expect(equity.accountBalanceAvailable).toBe(true)
    expect(equity.points).toHaveLength(7)

    const tradePoints = equity.points.filter((point) => point.kind === 'trade')
    expect(tradePoints).toHaveLength(4)
    expect(tradePoints[0]).toMatchObject({
      date: '2026-11-01',
      cumulativeNetPnlMicros: 790_000_000,
      accountBalanceMicros: 985_000_000,
      tradeCount: 1,
    })
    expect(tradePoints[1]).toMatchObject({
      date: '2026-11-02',
      cumulativeNetPnlMicros: -15_000_000,
      accountBalanceMicros: 1_180_000_000,
    })
    expect(tradePoints[2]).toMatchObject({
      date: '2026-11-03',
      cumulativeNetPnlMicros: -17_000_000,
      accountBalanceMicros: 1_178_000_000,
    })
    expect(tradePoints[3]).toMatchObject({
      date: '2026-11-04',
      cumulativeNetPnlMicros: null,
      accountBalanceMicros: null,
      netComplete: false,
    })

    const adjustmentPoints = equity.points.filter((point) => point.kind === 'adjustment')
    expect(adjustmentPoints).toHaveLength(3)
    expect(adjustmentPoints[0]).toMatchObject({
      adjustmentSignedAmountMicros: 1_000_000_000,
      accountBalanceMicros: 1_985_000_000,
    })
    expect(adjustmentPoints[1]).toMatchObject({
      adjustmentSignedAmountMicros: -200_000_000,
      accountBalanceMicros: 978_000_000,
    })

    const noAccount = await agent
      .get('/api/v1/analytics/equity?from=2026-11-01&to=2026-11-02')
      .expect(200)
    expect(noAccount.body.data.equity.accountBalanceAvailable).toBe(false)
    expect(noAccount.body.data.equity.accountBalanceMicros).toBeNull()
    expect(noAccount.body.data.equity.points[1].cumulativeNetPnlMicros).toBe(-15_000_000)
  })

  it('compares two periods with the same filters', async () => {
    const { agent, csrfToken } = await signedIn()
    await seedTrades(agent, csrfToken)

    const response = await agent
      .get(
        '/api/v1/analytics/compare?from=2026-11-01&to=2026-11-03&compareFrom=2026-10-15&compareTo=2026-10-15&basis=net',
      )
      .expect(200)
    const { current, baseline, deltas } = response.body.data.comparison

    expect(current.totalPnlMicros).toBe(-17_000_000)
    expect(baseline.totalPnlMicros).toBe(195_000_000)
    expect(deltas).toMatchObject({
      tradeCount: 2,
      totalPnlMicros: -212_000_000,
    })
    expect(Number(deltas.winRate)).toBeCloseTo(-2 / 3, 9)
    expect(Number(deltas.averageR)).toBeCloseTo(-0.6, 9)
  })

  it('validates and owner-scopes account adjustments', async () => {
    const { agent, csrfToken } = await signedIn()
    const reference = await referenceIds(agent)

    expect(
      (await request(app).get(`/api/v1/accounts/${reference.account.id}/adjustments`)).status,
    ).toBe(401)

    const invalid = await agent
      .post(`/api/v1/accounts/${reference.account.id}/adjustments`)
      .set('x-csrf-token', csrfToken)
      .send({ type: 'deposit', amount: '-10.00', date: '2026-11-01' })
    expect(invalid.status).toBe(400)

    const created = await agent
      .post(`/api/v1/accounts/${reference.account.id}/adjustments`)
      .set('x-csrf-token', csrfToken)
      .send({ type: 'withdrawal', amount: '25.00', date: '2026-11-02', note: 'Cash out' })
      .expect(201)
    expect(created.body.data.adjustment).toMatchObject({
      type: 'withdrawal',
      signedAmountMicros: -25_000_000,
      amount: '-25',
      version: 0,
    })

    const foreignAccount = await agent
      .post('/api/v1/accounts/000000000000000000000000/adjustments')
      .set('x-csrf-token', csrfToken)
      .send({ type: 'deposit', amount: '10.00', date: '2026-11-02' })
    expect(foreignAccount.status).toBe(400)

    const deleted = await agent
      .delete(`/api/v1/account-adjustments/${created.body.data.adjustment.id}`)
      .set('x-csrf-token', csrfToken)
      .send({ expectedVersion: 0 })
      .expect(200)
    expect(deleted.body.data.adjustment.deletedAt).not.toBeNull()

    const listed = await agent
      .get(`/api/v1/accounts/${reference.account.id}/adjustments`)
      .expect(200)
    expect(listed.body.data.adjustments).toHaveLength(0)
  })
})
