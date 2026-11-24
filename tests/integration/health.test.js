// @vitest-environment node

import request from 'supertest'
import pino from 'pino'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../src/server/app.js'

const silentLogger = pino({ level: 'silent' })

function buildApp({ mongoUp }) {
  return createApp({
    pingMongo: async () => mongoUp,
    logger: silentLogger,
    config: {
      appName: "Y's Journal",
      appVersion: '0.1.0',
      nodeEnv: 'test',
      clientDistDir: '/does-not-exist',
    },
  })
}

describe('GET /api/v1/health', () => {
  it('returns 200 and healthy status when MongoDB responds', async () => {
    const response = await request(buildApp({ mongoUp: true })).get('/api/v1/health')

    expect(response.status).toBe(200)
    expect(response.body.data).toMatchObject({
      status: 'ok',
      service: 'ys-journal-api',
      version: '0.1.0',
      environment: 'test',
      mongo: 'up',
    })
    expect(response.body.data.uptimeSeconds).toBeGreaterThanOrEqual(0)
    expect(response.body.data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('returns 503 and degraded status when MongoDB is unavailable', async () => {
    const response = await request(buildApp({ mongoUp: false })).get('/api/v1/health')

    expect(response.status).toBe(503)
    expect(response.body.data).toMatchObject({
      status: 'degraded',
      mongo: 'down',
    })
  })

  it('returns a structured 404 for unknown API routes without leaking a stack trace', async () => {
    const response = await request(buildApp({ mongoUp: true })).get('/api/v1/missing')

    expect(response.status).toBe(404)
    expect(response.body.error).toMatchObject({
      code: 'NOT_FOUND',
      requestId: expect.any(String),
    })
    expect(response.body.error.stack).toBeUndefined()
  })

  it('sets a request id header', async () => {
    const response = await request(buildApp({ mongoUp: true })).get('/api/v1/health')
    expect(response.headers['x-request-id']).toBeTruthy()
  })
})
