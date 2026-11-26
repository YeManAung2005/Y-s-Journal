// @vitest-environment node

import { rm } from 'node:fs/promises'
import request from 'supertest'
import sharp from 'sharp'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { addDays } from '../../src/shared/learning/streaks.js'
import { todayInTimeZone } from '../../src/server/lib/timezone.js'
import { LearningCategory } from '../../src/server/models/learning-category.js'
import { LearningRecord } from '../../src/server/models/learning-record.js'
import { User } from '../../src/server/models/user.js'
import { connectTestDb, disconnectTestDb, resetTestDb } from '../helpers/test-db.js'
import { buildTestApp, getCsrfToken, setupOwner, testStorageDir } from '../helpers/test-app.js'

describe('Phase 5 learning API', () => {
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
    const user = await setupOwner(agent)
    return { agent, user, csrfToken: await getCsrfToken(agent) }
  }

  async function createCategory(agent, csrfToken, overrides = {}) {
    const response = await agent
      .post('/api/v1/learning/categories')
      .set('x-csrf-token', csrfToken)
      .send({ name: 'Market structure', color: '#8b5cf6', ...overrides })
      .expect(201)
    return response.body.data.category
  }

  function recordPayload(categoryId, overrides = {}) {
    return {
      date: '2026-11-25',
      categoryId,
      topic: 'Liquidity sweeps',
      keyTakeaways: 'Wait for the reclaim before entering.',
      durationMinutes: 45,
      notes: 'Reviewed three examples.',
      resources: [{ label: 'Notes', url: 'https://example.com/notes' }],
      ...overrides,
    }
  }

  async function createRecord(agent, csrfToken, categoryId, overrides = {}) {
    const response = await agent
      .post('/api/v1/learning/records')
      .set('x-csrf-token', csrfToken)
      .send(recordPayload(categoryId, overrides))
      .expect(201)
    return response.body.data.record
  }

  async function createGoal(agent, csrfToken, categoryId, overrides = {}) {
    const response = await agent
      .post('/api/v1/learning/goals')
      .set('x-csrf-token', csrfToken)
      .send({
        title: 'Build a repeatable study routine',
        description: 'Finish the course and review notes weekly.',
        categoryId,
        targetDate: '2026-12-31',
        ...overrides,
      })
      .expect(201)
    return response.body.data.goal
  }

  it('requires authentication and CSRF, and rejects malformed learning IDs', async () => {
    expect((await request(app).get('/api/v1/learning/records')).status).toBe(401)

    const { agent, csrfToken } = await signedIn()
    const missingCsrf = await agent
      .post('/api/v1/learning/categories')
      .send({ name: 'Books', color: '#22c55e' })
    expect(missingCsrf.status).toBe(403)
    expect(missingCsrf.body.error.code).toBe('CSRF_INVALID')

    const malformed = await agent.get('/api/v1/learning/records/not-an-id')
    expect(malformed.status).toBe(400)
    expect(malformed.body.error.code).toBe('VALIDATION_ERROR')

    const category = await createCategory(agent, csrfToken)
    const invalidUrl = await agent
      .post('/api/v1/learning/records')
      .set('x-csrf-token', csrfToken)
      .send(
        recordPayload(category.id, { resources: [{ label: 'Bad', url: 'javascript:alert(1)' }] }),
      )
    expect(invalidUrl.status).toBe(400)
  })

  it('manages categories with archive, restore, and optimistic concurrency', async () => {
    const { agent, csrfToken } = await signedIn()
    const category = await createCategory(agent, csrfToken)
    expect(category).toMatchObject({
      name: 'Market structure',
      slug: 'market-structure',
      archivedAt: null,
      version: 0,
    })

    const duplicate = await agent
      .post('/api/v1/learning/categories')
      .set('x-csrf-token', csrfToken)
      .send({ name: 'Market Structure', color: '#22c55e' })
    expect(duplicate.status).toBe(409)
    expect(duplicate.body.error.code).toBe('CONFLICT')

    const updated = await agent
      .patch(`/api/v1/learning/categories/${category.id}`)
      .set('x-csrf-token', csrfToken)
      .send({ name: 'Price action', color: '#3b82f6', expectedVersion: 0 })
      .expect(200)
    expect(updated.body.data.category).toMatchObject({
      name: 'Price action',
      slug: 'price-action',
      color: '#3b82f6',
      version: 1,
    })

    const stale = await agent
      .patch(`/api/v1/learning/categories/${category.id}`)
      .set('x-csrf-token', csrfToken)
      .send({ name: 'Stale', expectedVersion: 0 })
    expect(stale.status).toBe(409)
    expect(stale.body.error.code).toBe('VERSION_CONFLICT')

    await agent
      .post(`/api/v1/learning/categories/${category.id}/archive`)
      .set('x-csrf-token', csrfToken)
      .expect(200)
    expect((await agent.get('/api/v1/learning/categories')).body.data.categories).toHaveLength(0)

    const archived = await agent.get('/api/v1/learning/categories?includeArchived=true').expect(200)
    expect(archived.body.data.categories[0].archivedAt).not.toBeNull()

    const restored = await agent
      .post(`/api/v1/learning/categories/${category.id}/restore`)
      .set('x-csrf-token', csrfToken)
      .expect(200)
    expect(restored.body.data.category.archivedAt).toBeNull()
  })

  it('creates records with snapshots, filters them, and isolates owners', async () => {
    const { agent, csrfToken, user } = await signedIn()
    const category = await createCategory(agent, csrfToken)
    const goal = await createGoal(agent, csrfToken, category.id)
    const record = await createRecord(agent, csrfToken, category.id, {
      goalId: goal.id,
    })

    expect(record).toMatchObject({
      date: '2026-11-25',
      categoryId: category.id,
      categorySnapshot: { id: category.id, name: 'Market structure' },
      goalId: goal.id,
      topic: 'Liquidity sweeps',
      durationMinutes: 45,
      version: 0,
      attachments: [],
    })

    await agent
      .patch(`/api/v1/learning/categories/${category.id}`)
      .set('x-csrf-token', csrfToken)
      .send({ name: 'Renamed category', expectedVersion: category.version })
      .expect(200)

    const detail = await agent.get(`/api/v1/learning/records/${record.id}`).expect(200)
    expect(detail.body.data.record.categorySnapshot.name).toBe('Market structure')

    const updated = await agent
      .patch(`/api/v1/learning/records/${record.id}`)
      .set('x-csrf-token', csrfToken)
      .send({
        keyTakeaways: 'Wait for confirmation.',
        durationMinutes: 60,
        expectedVersion: 0,
      })
      .expect(200)
    expect(updated.body.data.record).toMatchObject({
      keyTakeaways: 'Wait for confirmation.',
      durationMinutes: 60,
      version: 1,
    })

    const stale = await agent
      .patch(`/api/v1/learning/records/${record.id}`)
      .set('x-csrf-token', csrfToken)
      .send({ topic: 'Stale', expectedVersion: 0 })
    expect(stale.status).toBe(409)

    const foreign = await User.create({
      email: 'other@example.com',
      passwordHash: 'unused-test-hash',
      displayName: 'Other',
    })
    const foreignCategory = await LearningCategory.create({
      userId: foreign._id,
      name: 'Foreign category',
      slug: 'foreign-category',
      color: '#22c55e',
    })
    await LearningRecord.create({
      userId: foreign._id,
      date: '2026-11-25',
      categoryId: foreignCategory._id,
      categorySnapshot: {
        id: foreignCategory._id,
        name: foreignCategory.name,
        slug: foreignCategory.slug,
        color: foreignCategory.color,
      },
      topic: 'Foreign record',
      durationMinutes: 120,
    })

    const list = await agent
      .get(`/api/v1/learning/records?categoryId=${category.id}&goalId=${goal.id}`)
      .expect(200)
    expect(list.body.data.records).toHaveLength(1)
    expect(list.body.data.records[0].topic).toBe('Liquidity sweeps')

    const all = await agent.get('/api/v1/learning/records').expect(200)
    expect(all.body.data.records).toHaveLength(1)
    expect(all.body.data.records[0].topic).not.toBe('Foreign record')

    await agent
      .delete(`/api/v1/learning/records/${record.id}`)
      .set('x-csrf-token', csrfToken)
      .send({ expectedVersion: 1 })
      .expect(200)
    expect((await agent.get('/api/v1/learning/records')).body.data.records).toHaveLength(0)

    const withDeleted = await agent.get('/api/v1/learning/records?includeDeleted=true').expect(200)
    expect(withDeleted.body.data.records).toHaveLength(1)

    const restored = await agent
      .post(`/api/v1/learning/records/${record.id}/restore`)
      .set('x-csrf-token', csrfToken)
      .send({ expectedVersion: 2 })
      .expect(200)
    expect(restored.body.data.record.deletedAt).toBeNull()
    expect(restored.body.data.record.goalId).toBe(goal.id)
    expect(restored.body.data.record.id).toBe(record.id)
    expect(user.id).toBeTruthy()
  })

  it('uploads, serves, deletes, and restores private learning attachments', async () => {
    const { agent, csrfToken } = await signedIn()
    const category = await createCategory(agent, csrfToken)
    const record = await createRecord(agent, csrfToken, category.id)

    const png = await sharp({
      create: { width: 24, height: 16, channels: 3, background: { r: 12, g: 34, b: 56 } },
    })
      .png()
      .toBuffer()

    const upload = await agent
      .post(`/api/v1/learning/records/${record.id}/attachments`)
      .set('x-csrf-token', csrfToken)
      .attach('attachments', png, { filename: 'notes.png', contentType: 'image/png' })
      .expect(201)
    const attachment = upload.body.data.attachments[0]
    expect(attachment).toMatchObject({
      mimeType: 'image/png',
      width: 24,
      height: 16,
      ownerType: 'LearningRecord',
      ownerId: record.id,
    })

    const detail = await agent.get(`/api/v1/learning/records/${record.id}`).expect(200)
    expect(detail.body.data.record.attachments).toHaveLength(1)
    const view = await agent.get(attachment.url).expect(200)
    expect(view.headers['content-type']).toContain('image/png')
    expect(view.headers['cache-control']).toBe('no-store')

    await agent
      .delete(`/api/v1/learning/records/${record.id}`)
      .set('x-csrf-token', csrfToken)
      .send({ expectedVersion: 0 })
      .expect(200)
    await agent.get(attachment.url).expect(404)

    await agent
      .post(`/api/v1/learning/records/${record.id}/restore`)
      .set('x-csrf-token', csrfToken)
      .send({ expectedVersion: 1 })
      .expect(200)
    await agent.get(attachment.url).expect(200)

    await agent.delete(attachment.url).set('x-csrf-token', csrfToken).expect(200)
    await agent.get(attachment.url).expect(404)
  })

  it('enforces the per-record attachment limit', async () => {
    const { agent, csrfToken } = await signedIn()
    const category = await createCategory(agent, csrfToken)
    const record = await createRecord(agent, csrfToken, category.id)
    const png = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .png()
      .toBuffer()

    let upload = agent
      .post(`/api/v1/learning/records/${record.id}/attachments`)
      .set('x-csrf-token', csrfToken)
    for (let index = 0; index < 5; index += 1) {
      upload = upload.attach('attachments', png, {
        filename: `notes-${index}.png`,
        contentType: 'image/png',
      })
    }
    await upload.expect(201)

    const overLimit = await agent
      .post(`/api/v1/learning/records/${record.id}/attachments`)
      .set('x-csrf-token', csrfToken)
      .attach('attachments', png, { filename: 'notes-6.png', contentType: 'image/png' })
    expect(overLimit.status).toBe(400)
    expect(overLimit.body.error.code).toBe('FILE_LIMIT')
  })

  it('tracks goals, milestones, tasks, progress, and completion with version checks', async () => {
    const { agent, csrfToken } = await signedIn()
    const category = await createCategory(agent, csrfToken)
    const goal = await createGoal(agent, csrfToken, category.id)

    expect(goal).toMatchObject({
      status: 'active',
      progressPercent: 0,
      milestones: [],
      tasks: [],
      completedAt: null,
      version: 0,
    })

    const milestoneResponse = await agent
      .post(`/api/v1/learning/goals/${goal.id}/milestones`)
      .set('x-csrf-token', csrfToken)
      .send({ title: 'Finish module one', dueDate: '2026-12-01', expectedVersion: 0 })
      .expect(201)
    const milestone = milestoneResponse.body.data.goal.milestones[0]
    expect(milestoneResponse.body.data.goal.version).toBe(1)

    const taskResponse = await agent
      .post(`/api/v1/learning/goals/${goal.id}/tasks`)
      .set('x-csrf-token', csrfToken)
      .send({ title: 'Write a summary', expectedVersion: 1 })
      .expect(201)
    const task = taskResponse.body.data.goal.tasks[0]
    expect(taskResponse.body.data.goal.version).toBe(2)

    const milestoneDone = await agent
      .patch(`/api/v1/learning/goals/${goal.id}/milestones/${milestone.id}`)
      .set('x-csrf-token', csrfToken)
      .send({ completed: true, expectedVersion: 2 })
      .expect(200)
    expect(milestoneDone.body.data.goal).toMatchObject({
      progressPercent: 50,
      completedMilestoneCount: 1,
      version: 3,
    })
    expect(milestoneDone.body.data.goal.milestones[0].completedAt).not.toBeNull()

    const taskDone = await agent
      .patch(`/api/v1/learning/goals/${goal.id}/tasks/${task.id}`)
      .set('x-csrf-token', csrfToken)
      .send({ completed: true, expectedVersion: 3 })
      .expect(200)
    expect(taskDone.body.data.goal).toMatchObject({
      progressPercent: 100,
      completedTaskCount: 1,
      version: 4,
    })

    const stale = await agent
      .patch(`/api/v1/learning/goals/${goal.id}/tasks/${task.id}`)
      .set('x-csrf-token', csrfToken)
      .send({ completed: false, expectedVersion: 2 })
    expect(stale.status).toBe(409)

    const completed = await agent
      .patch(`/api/v1/learning/goals/${goal.id}`)
      .set('x-csrf-token', csrfToken)
      .send({ status: 'completed', expectedVersion: 4 })
      .expect(200)
    expect(completed.body.data.goal.status).toBe('completed')
    expect(completed.body.data.goal.completedAt).not.toBeNull()

    const taskRemoved = await agent
      .delete(`/api/v1/learning/goals/${goal.id}/tasks/${task.id}`)
      .set('x-csrf-token', csrfToken)
      .send({ expectedVersion: 5 })
      .expect(200)
    expect(taskRemoved.body.data.goal).toMatchObject({
      progressPercent: 100,
      completedTaskCount: 0,
      version: 6,
    })

    await agent
      .delete(`/api/v1/learning/goals/${goal.id}`)
      .set('x-csrf-token', csrfToken)
      .send({ expectedVersion: 6 })
      .expect(200)
    expect((await agent.get('/api/v1/learning/goals')).body.data.goals).toHaveLength(0)

    const restored = await agent
      .post(`/api/v1/learning/goals/${goal.id}/restore`)
      .set('x-csrf-token', csrfToken)
      .send({ expectedVersion: 7 })
      .expect(200)
    expect(restored.body.data.goal.deletedAt).toBeNull()
  })

  it('calculates daily study totals, targets, and current/longest streaks', async () => {
    const { agent, csrfToken } = await signedIn()
    const category = await createCategory(agent, csrfToken)
    const today = todayInTimeZone('Asia/Yangon')
    const yesterday = addDays(today, -1)
    const twoDaysAgo = addDays(today, -2)
    const threeDaysAgo = addDays(today, -3)

    for (const [date, durationMinutes] of [
      [threeDaysAgo, 60],
      [twoDaysAgo, 30],
      [yesterday, 60],
      [today, 20],
      [today, 40],
    ]) {
      await createRecord(agent, csrfToken, category.id, { date, durationMinutes })
    }

    const response = await agent.get('/api/v1/learning/summary').expect(200)
    expect(response.body.data.summary).toMatchObject({
      today,
      dailyTargetMinutes: 60,
      todayMinutes: 60,
      todayRecordCount: 2,
      targetMetToday: true,
      totalMinutes: 210,
      recordCount: 5,
      activeDays: 4,
      qualifyingDays: 3,
      currentStreak: 2,
      longestStreak: 2,
      lastStudyDate: today,
    })

    const filtered = await agent
      .get(`/api/v1/learning/summary?from=${today}&to=${today}`)
      .expect(200)
    expect(filtered.body.data.summary).toMatchObject({
      totalMinutes: 60,
      recordCount: 2,
      activeDays: 1,
      currentStreak: 2,
    })
    expect(filtered.body.data.summary.days).toHaveLength(1)
  })
})
