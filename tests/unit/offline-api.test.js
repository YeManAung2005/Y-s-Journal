import { resetOfflineDb, setOnline } from '../helpers/offline.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deriveCacheKey } from '../../src/client/offline/crypto.js'
import { setOfflineKey, listOperations } from '../../src/client/offline/store.js'
import { apiRequest, resetCsrfToken } from '../../src/client/lib/api.js'

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

beforeEach(async () => {
  await resetOfflineDb()
  resetCsrfToken()
  setOfflineKey(await deriveCacheKey('secure-passphrase-123', 'owner-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
  setOnline(true)
})

describe('offline-aware API queueing', () => {
  it('queues mutating resource requests and reports OFFLINE_QUEUED', async () => {
    setOnline(false)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      apiRequest('/trades', { method: 'POST', body: { expectedVersion: 0, symbol: 'ES' } }),
    ).rejects.toMatchObject({ code: 'OFFLINE_QUEUED', status: 0 })

    expect(fetchMock).not.toHaveBeenCalled()
    const operations = await listOperations()
    expect(operations).toHaveLength(1)
    expect(operations[0]).toMatchObject({
      method: 'POST',
      path: '/trades',
      body: { expectedVersion: 0, symbol: 'ES' },
      baseSnapshot: { expectedVersion: 0, symbol: 'ES' },
      status: 'pending',
    })
  })

  it('never queues authentication mutations', async () => {
    setOnline(false)
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      apiRequest('/auth/unlock', { method: 'POST', body: { password: 'x' } }),
    ).rejects.toThrow('Failed to fetch')
    expect(await listOperations()).toHaveLength(0)
  })

  it('queues a resource mutation when the host connection fails while online', async () => {
    setOnline(true)
    const fetchMock = vi.fn(async (url) => {
      if (url === '/api/v1/auth/csrf') {
        return jsonResponse({ data: { csrfToken: 'csrf-token' } })
      }
      throw new TypeError('Failed to fetch')
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      apiRequest('/journal/entries', { method: 'POST', body: { date: '2026-11-26' } }),
    ).rejects.toMatchObject({ code: 'OFFLINE_QUEUED' })

    const operations = await listOperations()
    expect(operations).toHaveLength(1)
    expect(operations[0]).toMatchObject({ path: '/journal/entries', method: 'POST' })
  })

  it('does not queue failed reads', async () => {
    setOnline(false)
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiRequest('/trades')).rejects.toThrow('Failed to fetch')
    expect(await listOperations()).toHaveLength(0)
  })
})
