import { ensureCsrf, resetCsrfToken } from '../lib/api.js'
import { isCacheableQuery, persistQueryCache, restoreQueryCache, clearQueryCache } from './cache.js'
import {
  clearCachedQueries,
  clearOfflineKey,
  getOfflineProfile,
  getOperation,
  initializeOffline,
  isOfflineUnlocked,
  rotateOfflinePassword,
  unlockOffline,
} from './store.js'
import { refreshQueueStatus, replayOperations, resolveConflict } from './queue.js'
import { resourceForPath } from './resources.js'
import { updateOfflineStatus } from './status.js'

let queryClient = null
let started = false
let persistTimer = null

function schedulePersist() {
  if (persistTimer) window.clearTimeout(persistTimer)
  persistTimer = window.setTimeout(() => {
    persistTimer = null
    void persistQueryCache(queryClient).catch(() => {})
  }, 250)
}

async function sendOperation(operation) {
  const url = `/api/v1${operation.path}`
  const headers = { accept: 'application/json', 'idempotency-key': operation.idempotencyKey }

  const isFormData = typeof FormData !== 'undefined' && operation.body instanceof FormData
  const body = isFormData
    ? operation.body
    : operation.body === undefined
      ? undefined
      : JSON.stringify(operation.body)

  if (body !== undefined && !isFormData) headers['content-type'] = 'application/json'
  headers['x-csrf-token'] = await ensureCsrf()

  const send = () =>
    fetch(url, {
      method: operation.method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers,
      body,
    })

  let response = await send()
  let payload = await response.json().catch(() => null)

  if (response.status === 403 && payload?.error?.code === 'CSRF_INVALID') {
    headers['x-csrf-token'] = await ensureCsrf({ force: true })
    response = await send()
    payload = await response.json().catch(() => null)
  }

  return {
    ok: response.ok && !payload?.error,
    status: response.status,
    code: payload?.error?.code,
    message: payload?.error?.message,
    data: payload?.data,
  }
}

export function setupOffline(client) {
  if (started) return
  started = true
  queryClient = client

  updateOfflineStatus({
    online: navigator.onLine !== false,
    unlocked: isOfflineUnlocked(),
  })
  void refreshQueueStatus()

  client.getQueryCache().subscribe((event) => {
    if (event.type === 'updated' && isCacheableQuery(event.query)) schedulePersist()
  })

  window.addEventListener('online', () => {
    updateOfflineStatus({ online: true })
    void syncNow()
  })
  window.addEventListener('offline', () => updateOfflineStatus({ online: false }))
}

export async function syncNow() {
  if (!queryClient || navigator.onLine === false || !isOfflineUnlocked()) {
    return { skipped: true }
  }

  const result = await replayOperations({ send: sendOperation })
  if (result.replayed > 0) {
    await queryClient.invalidateQueries()
    await persistQueryCache(queryClient)
  }
  return result
}

export async function unlockOfflineSession({ password, userId, email, displayName, profile }) {
  const existing = profile ?? (await getOfflineProfile())

  if (existing) {
    const unlocked = await unlockOffline(password, existing)
    if (!unlocked) {
      throw new Error('Incorrect password. The offline cache stays locked.')
    }
  } else {
    await initializeOffline({ password, userId, email, displayName })
  }

  updateOfflineStatus({ unlocked: true })
  if (queryClient) await restoreQueryCache(queryClient)
  await refreshQueueStatus()
  await syncNow()
  return existing ?? (await getOfflineProfile())
}

export function lockOfflineSession() {
  clearOfflineKey()
  if (queryClient) clearQueryCache(queryClient)
  updateOfflineStatus({ unlocked: false })
}

export async function signOutOfflineSession() {
  clearOfflineKey()
  await clearCachedQueries()
  if (queryClient) clearQueryCache(queryClient)
  updateOfflineStatus({ unlocked: false })
  await refreshQueueStatus()
}

export async function changeOfflinePassword({ currentPassword, newPassword }) {
  const profile = await getOfflineProfile()
  if (!profile) return false
  const rotated = await rotateOfflinePassword({ currentPassword, newPassword, profile })
  if (rotated) {
    updateOfflineStatus({ unlocked: true })
    await refreshQueueStatus()
  }
  return rotated
}

export async function resolveConflictAction({ id, action, body, expectedVersion }) {
  if (action === 'use-mine') {
    const operation = await listOperationForConflict(id)
    const target = operation ? resourceForPath(operation.path) : null
    let version = expectedVersion

    if (target && navigator.onLine !== false) {
      const response = await fetch(`/api/v1/sync/resources/${target.type}/${target.id}`, {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { accept: 'application/json' },
      })
      const payload = await response.json().catch(() => null)
      version = payload?.data?.resource?.version
    }

    if (version === undefined) {
      throw new Error('The current server version could not be loaded. Review and retry manually.')
    }
    const outcome = await resolveConflict(id, {
      action: 'use-mine',
      body,
      expectedVersion: version,
    })
    if (outcome.replay) await syncNow()
    return outcome
  }

  const outcome = await resolveConflict(id, { action, body, expectedVersion })
  if (outcome.replay) await syncNow()
  return outcome
}

async function listOperationForConflict(id) {
  return getOperation(id)
}

export { resetCsrfToken }
