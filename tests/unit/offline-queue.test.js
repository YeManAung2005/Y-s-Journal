import { resetOfflineDb } from '../helpers/offline.js'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { deriveCacheKey } from '../../src/client/offline/crypto.js'
import { getOfflineStatus } from '../../src/client/offline/status.js'
import { enqueueOperation, listOperations, setOfflineKey } from '../../src/client/offline/store.js'
import {
  discardOperation,
  queueMutation,
  refreshQueueStatus,
  replayOperations,
  resolveConflict,
} from '../../src/client/offline/queue.js'

beforeAll(async () => {
  const key = await deriveCacheKey('secure-passphrase-123', 'owner-1')
  setOfflineKey(key)
})

beforeEach(async () => {
  await resetOfflineDb()
  const key = await deriveCacheKey('secure-passphrase-123', 'owner-1')
  setOfflineKey(key)
})

async function enqueueAt(time, operation) {
  const now = vi.spyOn(Date, 'now').mockReturnValue(time)
  try {
    return await enqueueOperation(operation)
  } finally {
    now.mockRestore()
  }
}

describe('offline mutation queue', () => {
  it('tracks pending operations and quota failures', async () => {
    await queueMutation({ method: 'PATCH', path: '/trades/trade-1', body: { expectedVersion: 1 } })
    expect(await listOperations()).toHaveLength(1)
    expect(getOfflineStatus()).toMatchObject({ pending: 1, conflicts: 0, blocked: 0 })

    const put = vi
      .spyOn((await import('../../src/client/offline/db.js')).offlineDb.operations, 'put')
      .mockRejectedValueOnce(Object.assign(new Error('full'), { name: 'QuotaExceededError' }))

    await expect(
      queueMutation({ method: 'PATCH', path: '/trades/trade-2', body: {} }),
    ).rejects.toMatchObject({ name: 'OfflineQuotaError' })
    expect(getOfflineStatus().quotaError).toContain('Browser storage is full')
    put.mockRestore()
  })

  it('replays pending operations in sequence order', async () => {
    await enqueueAt(100, { method: 'PATCH', path: '/trades/first', body: {} })
    await enqueueAt(200, { method: 'PATCH', path: '/trades/second', body: {} })
    await enqueueAt(300, { method: 'PATCH', path: '/trades/third', body: {} })

    const seen = []
    const result = await replayOperations({
      send: async (operation) => {
        seen.push(operation.path)
        return { ok: true, status: 200 }
      },
    })

    expect(seen).toEqual(['/trades/first', '/trades/second', '/trades/third'])
    expect(result).toEqual({ replayed: 3, stopped: false })
    expect(await listOperations()).toHaveLength(0)
    expect(getOfflineStatus()).toMatchObject({ pending: 0, syncing: false })
  })

  it('stores a conflict and pauses dependents without overwriting data', async () => {
    await enqueueAt(100, { method: 'PATCH', path: '/trades/first', body: {} })
    await enqueueAt(200, { method: 'PATCH', path: '/trades/conflict', body: { title: 'mine' } })
    await enqueueAt(300, { method: 'PATCH', path: '/trades/dependent', body: {} })

    const seen = []
    const result = await replayOperations({
      send: async (operation) => {
        seen.push(operation.path)
        if (operation.path === '/trades/conflict') {
          return { ok: false, status: 409, code: 'VERSION_CONFLICT', message: 'Server changed' }
        }
        return { ok: true, status: 200 }
      },
    })

    expect(seen).toEqual(['/trades/first', '/trades/conflict'])
    expect(result).toEqual({ replayed: 1, stopped: true })

    const operations = await listOperations()
    expect(operations.map((operation) => operation.status)).toEqual(['conflict', 'pending'])
    expect(operations[0]).toMatchObject({
      body: { title: 'mine' },
      error: { code: 'VERSION_CONFLICT', message: 'Server changed' },
    })
    expect(getOfflineStatus()).toMatchObject({ conflicts: 1, pending: 1 })
  })

  it('leaves operations pending when the network is unavailable', async () => {
    await enqueueOperation({ method: 'PATCH', path: '/trades/trade-1', body: {} })

    const result = await replayOperations({
      send: async () => {
        throw new Error('offline')
      },
    })

    expect(result).toEqual({ replayed: 0, stopped: true })
    expect((await listOperations())[0]).toMatchObject({ status: 'pending' })
    expect(getOfflineStatus()).toMatchObject({ syncing: false, pending: 1 })
  })

  it('marks non-conflict rejections as blocked', async () => {
    await enqueueOperation({ method: 'PATCH', path: '/trades/trade-1', body: {} })

    await replayOperations({
      send: async () => ({ ok: false, status: 400, code: 'VALIDATION_ERROR', message: 'Invalid' }),
    })

    expect((await listOperations())[0]).toMatchObject({
      status: 'blocked',
      error: { code: 'VALIDATION_ERROR' },
    })
  })

  it('applies user conflict choices without silent overwrites', async () => {
    const conflictId = await enqueueOperation({
      method: 'PATCH',
      path: '/trades/trade-1',
      body: { title: 'mine', expectedVersion: 1 },
    })
    await updateStatusForConflict()

    const overwritten = await resolveConflict(conflictId, {
      action: 'use-mine',
      body: { title: 'merged' },
      expectedVersion: 7,
    })
    expect(overwritten).toEqual({ replay: true })
    expect((await listOperations())[0]).toMatchObject({
      status: 'pending',
      body: { title: 'merged', expectedVersion: 7 },
      error: null,
    })

    await resolveConflict(conflictId, { action: 'keep-server' })
    expect(await listOperations()).toHaveLength(0)

    const blockedId = await enqueueOperation({ method: 'PATCH', path: '/trades/trade-2', body: {} })
    await discardOperation(blockedId)
    expect(await listOperations()).toHaveLength(0)
  })
})

async function updateStatusForConflict() {
  await refreshQueueStatus()
}
