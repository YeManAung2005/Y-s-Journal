// @vitest-environment node

import pino from 'pino'
import { createApp } from '../../src/server/app.js'

export const silentLogger = pino({ level: 'silent' })

export const testConfig = Object.freeze({
  appName: "Y's Journal",
  appVersion: '0.1.0',
  nodeEnv: 'test',
  clientDistDir: '/does-not-exist',
})

export function buildTestApp({ rateLimitEnabled = false, nodeEnv = 'test' } = {}) {
  return createApp({
    pingMongo: async () => true,
    logger: silentLogger,
    config: { ...testConfig, nodeEnv },
    rateLimitEnabled,
  })
}

export async function getCsrfToken(agent) {
  const response = await agent.get('/api/v1/auth/csrf').expect(200)
  return response.body.data.csrfToken
}

export async function setupOwner(agent) {
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

  return response.body.data.user
}
