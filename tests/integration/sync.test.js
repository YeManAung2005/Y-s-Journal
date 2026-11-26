// @vitest-environment node

import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { SyncOperation } from '../../src/server/models/sync-operation.js'
import { connectTestDb, disconnectTestDb, resetTestDb } from '../helpers/test-db.js'
import { buildTestApp, getCsrfToken, setupOwner } from '../helpers/test-app.js'

const instrumentPayload = {
  symbol: 'ES2',
  name: 'Offline Replay Instrument',
  pointValueMicros: 50_000_000,
  tickValueMicros: 12_500_000,
  tickSizeMicros: 250_000,
}

describe('Phase 9 sync API', () => {
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
    const user = await setupOwner(agent)
    return { agent, csrfToken: await getCsrfToken(agent), user }
  }

  it('returns current owner-scoped resource versions for conflict comparison', async () => {
    const { agent, csrfToken } = await signedInAgent()
    const created = await agent
      .post('/api/v1/reference/instruments')
      .set('x-csrf-token', csrfToken)
      .send(instrumentPayload)
      .expect(201)
    const id = created.body.data.instrument.id

    const resource = await agent.get(`/api/v1/sync/resources/instruments/${id}`).expect(200)
    expect(resource.headers['cache-control']).toBe('no-store')
    expect(resource.body.data.resource).toMatchObject({ id, symbol: 'ES2', version: 0 })
    expect(resource.body.data.resource).not.toHaveProperty('userId')
  })

  it('rejects unknown resource types, missing auth, and unknown records', async () => {
    const unauthenticated = await request(app).get(
      '/api/v1/sync/resources/instruments/000000000000000000000000',
    )
    expect(unauthenticated.status).toBe(401)

    const { agent } = await signedInAgent()
    const unknownType = await agent.get('/api/v1/sync/resources/secrets/000000000000000000000000')
    expect(unknownType.status).toBe(400)
    expect(unknownType.body.error.code).toBe('VALIDATION_ERROR')

    const unknownRecord = await agent.get(
      '/api/v1/sync/resources/instruments/000000000000000000000000',
    )
    expect(unknownRecord.status).toBe(404)
    expect(unknownRecord.body.error.code).toBe('NOT_FOUND')
  })

  it('replays idempotent mutations without creating duplicates', async () => {
    const { agent, csrfToken } = await signedInAgent()
    const key = 'replay-key-0001'

    const first = await agent
      .post('/api/v1/reference/instruments')
      .set('x-csrf-token', csrfToken)
      .set('Idempotency-Key', key)
      .send(instrumentPayload)
      .expect(201)
    expect(first.headers['x-ysj-replayed']).toBeUndefined()

    const replay = await agent
      .post('/api/v1/reference/instruments')
      .set('x-csrf-token', csrfToken)
      .set('Idempotency-Key', key)
      .send(instrumentPayload)
      .expect(201)

    expect(replay.headers['x-ysj-replayed']).toBe('true')
    expect(replay.body).toEqual(first.body)

    const reference = await agent.get('/api/v1/reference?includeArchived=true').expect(200)
    expect(reference.body.data.instruments.filter((item) => item.symbol === 'ES2')).toHaveLength(1)
  })

  it('rejects invalid idempotency keys and concurrent replays', async () => {
    const { agent, csrfToken, user } = await signedInAgent()

    const invalid = await agent
      .post('/api/v1/reference/instruments')
      .set('x-csrf-token', csrfToken)
      .set('Idempotency-Key', 'bad key!')
      .send(instrumentPayload)
    expect(invalid.status).toBe(400)
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR')

    await SyncOperation.create({
      userId: user.id,
      key: 'pending-key-01',
      method: 'POST',
      path: '/api/v1/reference/instruments',
      status: 'pending',
    })

    const pending = await agent
      .post('/api/v1/reference/instruments')
      .set('x-csrf-token', csrfToken)
      .set('Idempotency-Key', 'pending-key-01')
      .send(instrumentPayload)
    expect(pending.status).toBe(409)
    expect(pending.body.error.code).toBe('SYNC_IN_PROGRESS')

    const reference = await agent.get('/api/v1/reference').expect(200)
    expect(reference.body.data.instruments.some((item) => item.symbol === 'ES2')).toBe(false)
  })
})
