import { resetOfflineDb } from '../helpers/offline.js'
import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it } from 'vitest'
import { CACHE_KEY } from '../../src/client/offline/cache.js'
import {
  clearCachedQueries,
  clearOfflineData,
  clearOfflineKey,
  enqueueOperation,
  getCachedQuery,
  getOfflineProfile,
  initializeOffline,
  isOfflineUnlocked,
  listOperations,
  putCachedQuery,
  rotateOfflinePassword,
  unlockOffline,
  verifyOfflinePassword,
} from '../../src/client/offline/store.js'
import { persistQueryCache, restoreQueryCache } from '../../src/client/offline/cache.js'
import { offlineDb } from '../../src/client/offline/db.js'

const identity = {
  password: 'secure-passphrase-123',
  userId: 'owner-1',
  email: 'owner@example.com',
  displayName: 'Owner',
}

beforeEach(resetOfflineDb)

describe('encrypted offline store', () => {
  it('stores a local verifier instead of the password and unlocks only with it', async () => {
    await initializeOffline(identity)
    const profile = await getOfflineProfile()

    expect(profile).toMatchObject({
      userId: identity.userId,
      email: identity.email,
      displayName: identity.displayName,
    })
    expect(profile).not.toHaveProperty('password')
    expect(profile).not.toHaveProperty('key')
    expect(await verifyOfflinePassword(identity.password, profile)).toBe(true)
    expect(await verifyOfflinePassword('wrong-passphrase', profile)).toBe(false)

    clearOfflineKey()
    expect(isOfflineUnlocked()).toBe(false)
    expect(await unlockOffline('wrong-passphrase', profile)).toBe(false)
    expect(isOfflineUnlocked()).toBe(false)
    expect(await unlockOffline(identity.password, profile)).toBe(true)
    expect(isOfflineUnlocked()).toBe(true)
  })

  it('encrypts cached query data and refuses access while locked', async () => {
    await initializeOffline(identity)
    const value = { entries: ['private journal reflection'] }
    await putCachedQuery('trades', value)

    const raw = await offlineDb.cache.get('trades')
    expect(raw).toHaveProperty('iv')
    expect(raw).toHaveProperty('payload')
    expect(JSON.stringify(raw)).not.toContain('private journal reflection')
    expect(await getCachedQuery('trades')).toEqual(value)

    clearOfflineKey()
    await expect(getCachedQuery('trades')).rejects.toThrow('The offline cache is locked.')
  })

  it('encrypts queued operations and assigns a record ID to creates', async () => {
    await initializeOffline(identity)
    const patchId = await enqueueOperation({
      method: 'PATCH',
      path: '/trades/trade-1',
      body: { expectedVersion: 2, notes: 'private trade note' },
    })
    const createId = await enqueueOperation({
      method: 'POST',
      path: '/journal/entries',
      body: { date: '2026-11-26' },
    })

    const rawPatch = await offlineDb.operations.get(patchId)
    expect(JSON.stringify(rawPatch)).not.toContain('private trade note')

    const operations = await listOperations()
    expect(operations).toHaveLength(2)
    expect(operations[0]).toMatchObject({
      id: patchId,
      method: 'PATCH',
      path: '/trades/trade-1',
      status: 'pending',
      idempotencyKey: patchId,
      recordId: null,
      body: { expectedVersion: 2, notes: 'private trade note' },
    })
    expect(operations[1]).toMatchObject({
      id: createId,
      method: 'POST',
      recordId: createId,
      body: { date: '2026-11-26' },
    })
  })

  it('rotates the key on password change and invalidates old cached data', async () => {
    await initializeOffline(identity)
    await putCachedQuery(CACHE_KEY, { queries: [{ queryKey: ['trades'], state: { data: 1 } }] })
    await enqueueOperation({
      method: 'PATCH',
      path: '/trades/trade-1',
      body: { expectedVersion: 3 },
    })
    const profile = await getOfflineProfile()

    expect(
      await rotateOfflinePassword({
        currentPassword: 'wrong-passphrase',
        newPassword: 'new-passphrase-456',
        profile,
      }),
    ).toBe(false)

    expect(
      await rotateOfflinePassword({
        currentPassword: identity.password,
        newPassword: 'new-passphrase-456',
        profile,
      }),
    ).toBe(true)

    const rotatedProfile = await getOfflineProfile()
    expect(await verifyOfflinePassword(identity.password, rotatedProfile)).toBe(false)
    expect(await verifyOfflinePassword('new-passphrase-456', rotatedProfile)).toBe(true)
    expect(await getCachedQuery(CACHE_KEY)).toBeUndefined()
    expect((await listOperations())[0]).toMatchObject({
      method: 'PATCH',
      body: { expectedVersion: 3 },
    })
  })

  it('clears cached records and operations on sign-out but keeps the unlock verifier', async () => {
    await initializeOffline(identity)
    await putCachedQuery('trades', { items: 1 })
    await enqueueOperation({ method: 'PATCH', path: '/trades/trade-1', body: {} })

    await clearOfflineData()
    await clearCachedQueries()

    expect(await offlineDb.cache.count()).toBe(0)
    expect(await offlineDb.operations.count()).toBe(0)
    expect(await getOfflineProfile()).not.toBeNull()
  })

  it('persists only allowlisted successful queries and restores them after unlock', async () => {
    await initializeOffline(identity)
    const source = new QueryClient()
    source.setQueryData(['trades', 'list'], { trades: [1] })
    source.setQueryData(['auth', 'session'], { token: 'do-not-cache' })

    expect(await persistQueryCache(source)).toBe(true)

    clearOfflineKey()
    const target = new QueryClient()
    expect(await restoreQueryCache(target)).toBe(false)

    await unlockOffline(identity.password, await getOfflineProfile())
    expect(await restoreQueryCache(target)).toBe(true)
    expect(target.getQueryData(['trades', 'list'])).toEqual({ trades: [1] })
    expect(target.getQueryData(['auth', 'session'])).toBeUndefined()
  })
})
