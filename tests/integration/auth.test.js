// @vitest-environment node

import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Session } from '../../src/server/models/session.js'
import { connectTestDb, disconnectTestDb, resetTestDb } from '../helpers/test-db.js'
import { buildTestApp, getCsrfToken, setupOwner } from '../helpers/test-app.js'

const ownerPayload = {
  email: 'owner@example.com',
  displayName: 'Owner',
  password: 'secure-passphrase-123',
  confirmPassword: 'secure-passphrase-123',
}

describe('Phase 1 authentication API', () => {
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

  it('completes one-time owner onboarding and creates defaults', async () => {
    const agent = request.agent(app)

    const status = await agent.get('/api/v1/onboarding/status').expect(200)
    expect(status.body.data.setupRequired).toBe(true)

    const noCsrf = await agent.post('/api/v1/onboarding').send(ownerPayload)
    expect(noCsrf.status).toBe(403)
    expect(noCsrf.body.error.code).toBe('CSRF_INVALID')

    const csrfToken = await getCsrfToken(agent)
    const weak = await agent
      .post('/api/v1/onboarding')
      .set('x-csrf-token', csrfToken)
      .send({ ...ownerPayload, password: 'short123' })
    expect(weak.status).toBe(400)
    expect(weak.body.error.code).toBe('VALIDATION_ERROR')

    const created = await agent
      .post('/api/v1/onboarding')
      .set('x-csrf-token', csrfToken)
      .send(ownerPayload)
      .expect(201)

    expect(created.body.data.user).toMatchObject({
      email: 'owner@example.com',
      displayName: 'Owner',
      role: 'owner',
    })
    expect(created.body.data.user).not.toHaveProperty('passwordHash')

    const cookie = created.headers['set-cookie'].join(';')
    expect(cookie).toContain('ysj_sid=')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Strict')

    const statusAfter = await agent.get('/api/v1/onboarding/status').expect(200)
    expect(statusAfter.body.data.setupRequired).toBe(false)

    const settings = await agent.get('/api/v1/settings').expect(200)
    expect(settings.body.data.settings).toMatchObject({
      theme: 'dark',
      appTimeZone: 'Asia/Yangon',
      tradingTimeZone: 'America/New_York',
      dailyStudyTargetMinutes: 60,
    })

    const secondAttempt = await agent
      .post('/api/v1/onboarding')
      .set('x-csrf-token', csrfToken)
      .send(ownerPayload)
    expect(secondAttempt.status).toBe(409)
    expect(secondAttempt.body.error.code).toBe('SETUP_COMPLETE')
  })

  it('signs in, logs failures, and records security events', async () => {
    const ownerAgent = request.agent(app)
    await setupOwner(ownerAgent)

    const loginAgent = request.agent(app)
    const csrfToken = await getCsrfToken(loginAgent)

    const failure = await loginAgent
      .post('/api/v1/auth/login')
      .set('x-csrf-token', csrfToken)
      .send({ email: ownerPayload.email, password: 'wrong-passphrase-999' })

    expect(failure.status).toBe(401)
    expect(failure.body.error.code).toBe('INVALID_CREDENTIALS')

    const events = await ownerAgent.get('/api/v1/security/events?limit=10').expect(200)
    expect(events.body.data.events.some((event) => event.type === 'login_failed')).toBe(true)
    expect(events.body.data.events.some((event) => event.type === 'onboarding_completed')).toBe(
      true,
    )

    const success = await loginAgent
      .post('/api/v1/auth/login')
      .set('x-csrf-token', csrfToken)
      .send({ email: ownerPayload.email, password: ownerPayload.password })
      .expect(200)

    expect(success.body.data.user.email).toBe(ownerPayload.email)
    await loginAgent.get('/api/v1/auth/session').expect(200)
  })

  it('requires authentication for protected endpoints', async () => {
    const session = await request(app).get('/api/v1/auth/session')
    expect(session.status).toBe(401)
    expect(session.body.error.code).toBe('AUTH_REQUIRED')

    const settings = await request(app).get('/api/v1/settings')
    expect(settings.status).toBe(401)

    const events = await request(app).get('/api/v1/security/events')
    expect(events.status).toBe(401)
  })

  it('revokes the session on sign out and rejects expired sessions', async () => {
    const agent = request.agent(app)
    await setupOwner(agent)
    const csrfToken = await getCsrfToken(agent)

    await agent.post('/api/v1/auth/logout').set('x-csrf-token', csrfToken).expect(200)
    const afterLogout = await agent.get('/api/v1/auth/session')
    expect(afterLogout.status).toBe(401)

    const loginCsrf = await getCsrfToken(agent)
    await agent
      .post('/api/v1/auth/login')
      .set('x-csrf-token', loginCsrf)
      .send({ email: ownerPayload.email, password: ownerPayload.password })
      .expect(200)

    await Session.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } })

    const expired = await agent.get('/api/v1/auth/session')
    expect(expired.status).toBe(401)
    expect(expired.body.error.code).toBe('SESSION_EXPIRED')
  })

  it('unlocks the workspace only with the owner password', async () => {
    const agent = request.agent(app)
    await setupOwner(agent)
    const csrfToken = await getCsrfToken(agent)

    const wrong = await agent
      .post('/api/v1/auth/unlock')
      .set('x-csrf-token', csrfToken)
      .send({ password: 'not-the-password' })
    expect(wrong.status).toBe(401)
    expect(wrong.body.error.code).toBe('INVALID_PASSWORD')

    await agent
      .post('/api/v1/auth/unlock')
      .set('x-csrf-token', csrfToken)
      .send({ password: ownerPayload.password })
      .expect(200)
  })

  it('changes the password and revokes other sessions', async () => {
    const ownerAgent = request.agent(app)
    await setupOwner(ownerAgent)

    const otherAgent = request.agent(app)
    const otherCsrf = await getCsrfToken(otherAgent)
    await otherAgent
      .post('/api/v1/auth/login')
      .set('x-csrf-token', otherCsrf)
      .send({ email: ownerPayload.email, password: ownerPayload.password })
      .expect(200)

    const ownerCsrf = await getCsrfToken(ownerAgent)
    const wrong = await ownerAgent
      .post('/api/v1/auth/password')
      .set('x-csrf-token', ownerCsrf)
      .send({
        currentPassword: 'wrong-current-password',
        newPassword: 'new-secure-passphrase-456',
        confirmNewPassword: 'new-secure-passphrase-456',
      })
    expect(wrong.status).toBe(401)

    await ownerAgent
      .post('/api/v1/auth/password')
      .set('x-csrf-token', ownerCsrf)
      .send({
        currentPassword: ownerPayload.password,
        newPassword: 'new-secure-passphrase-456',
        confirmNewPassword: 'new-secure-passphrase-456',
      })
      .expect(200)

    await ownerAgent.get('/api/v1/auth/session').expect(200)
    const revoked = await otherAgent.get('/api/v1/auth/session')
    expect(revoked.status).toBe(401)
  })

  it('validates and persists owner settings', async () => {
    const agent = request.agent(app)
    await setupOwner(agent)
    const csrfToken = await getCsrfToken(agent)

    const patch = await agent
      .patch('/api/v1/settings')
      .set('x-csrf-token', csrfToken)
      .send({
        theme: 'light',
        fontScale: 1.1,
        reducedMotion: true,
        appTimeZone: 'UTC',
        dailyStudyTargetMinutes: 90,
      })
      .expect(200)

    expect(patch.body.data.settings).toMatchObject({
      theme: 'light',
      fontScale: 1.1,
      reducedMotion: true,
      appTimeZone: 'UTC',
      dailyStudyTargetMinutes: 90,
    })

    const invalidZone = await agent
      .patch('/api/v1/settings')
      .set('x-csrf-token', csrfToken)
      .send({ tradingTimeZone: 'Mars/Olympus' })
    expect(invalidZone.status).toBe(400)

    const unknownField = await agent
      .patch('/api/v1/settings')
      .set('x-csrf-token', csrfToken)
      .send({ journalContent: 'must never be a setting' })
    expect(unknownField.status).toBe(400)

    const missingCsrf = await agent.patch('/api/v1/settings').send({ theme: 'dark' })
    expect(missingCsrf.status).toBe(403)
  })

  it('rejects cross-origin state changes even with a valid token', async () => {
    const agent = request.agent(app)
    const csrfToken = await getCsrfToken(agent)

    const response = await agent
      .post('/api/v1/onboarding')
      .set('x-csrf-token', csrfToken)
      .set('Origin', 'http://evil.example')
      .send(ownerPayload)

    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe('CSRF_INVALID')
  })

  it('uses hardened cookie names and attributes in production', async () => {
    const productionApp = buildTestApp({ nodeEnv: 'production' })
    const csrfResponse = await request(productionApp).get('/api/v1/auth/csrf').expect(200)
    const csrfCookie = csrfResponse.headers['set-cookie'][0]

    expect(csrfCookie).toContain('__Host-ysj_csrf=')
    expect(csrfCookie).toContain('Secure')
    expect(csrfCookie).toContain('SameSite=Strict')

    const created = await request(productionApp)
      .post('/api/v1/onboarding')
      .set('Cookie', csrfCookie.split(';')[0])
      .set('x-csrf-token', csrfResponse.body.data.csrfToken)
      .send(ownerPayload)
      .expect(201)

    const sessionCookie = created.headers['set-cookie'].find((value) =>
      value.startsWith('__Host-ysj_sid='),
    )
    expect(sessionCookie).toBeDefined()
    expect(sessionCookie).toContain('Secure')
    expect(sessionCookie).toContain('HttpOnly')
    expect(sessionCookie).toContain('Path=/')
    expect(sessionCookie).toContain('SameSite=Strict')
  })
})

describe('Phase 1 rate limiting', () => {
  beforeAll(async () => {
    await connectTestDb()
  })

  beforeEach(async () => {
    await resetTestDb()
  })

  afterAll(async () => {
    await disconnectTestDb()
  })

  it('limits repeated sign-in attempts', async () => {
    const app = buildTestApp({ rateLimitEnabled: true })
    const agent = request.agent(app)
    const csrfToken = await getCsrfToken(agent)

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await agent
        .post('/api/v1/auth/login')
        .set('x-csrf-token', csrfToken)
        .send({ email: 'unknown@example.com', password: 'some-passphrase-123' })
      expect(response.status).toBe(401)
    }

    const limited = await agent
      .post('/api/v1/auth/login')
      .set('x-csrf-token', csrfToken)
      .send({ email: 'unknown@example.com', password: 'some-passphrase-123' })

    expect(limited.status).toBe(429)
    expect(limited.body.error.code).toBe('RATE_LIMITED')
  })
})
