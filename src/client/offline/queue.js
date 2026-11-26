import {
  deleteOperation,
  enqueueOperation,
  listOperations,
  updateOperation,
  updateOperationPayload,
} from './store.js'
import { updateOfflineStatus } from './status.js'

let replaying = false

export async function refreshQueueStatus() {
  try {
    const operations = await listOperations()
    updateOfflineStatus({
      pending: operations.filter((operation) => operation.status === 'pending').length,
      conflicts: operations.filter((operation) => operation.status === 'conflict').length,
      blocked: operations.filter((operation) => operation.status === 'blocked').length,
      quotaError: null,
    })
  } catch {
    updateOfflineStatus({ pending: 0, conflicts: 0, blocked: 0 })
  }
}

export async function queueMutation(operation) {
  try {
    const id = await enqueueOperation(operation)
    await refreshQueueStatus()
    return id
  } catch (error) {
    if (error?.name === 'OfflineQuotaError') {
      updateOfflineStatus({ quotaError: error.message })
    }
    throw error
  }
}

function conflictResult(result) {
  return (
    result.status === 409 &&
    ['VERSION_CONFLICT', 'CONFLICT', 'SYNC_IN_PROGRESS'].includes(result.code)
  )
}

export async function replayOperations({ send }) {
  if (replaying) return { replayed: 0, stopped: false }
  replaying = true
  updateOfflineStatus({ syncing: true })

  let replayed = 0
  let stopped = false

  try {
    const operations = await listOperations()
    const pending = operations.filter((operation) => operation.status === 'pending')

    for (const operation of pending) {
      let result
      try {
        result = await send(operation)
      } catch {
        result = { ok: false, networkError: true }
      }

      if (result.ok) {
        await deleteOperation(operation.id)
        replayed += 1
        continue
      }

      if (result.networkError) {
        stopped = true
        break
      }

      const error = {
        code: result.code ?? 'REQUEST_FAILED',
        message: result.message ?? `Request failed (${result.status ?? 0}).`,
      }

      const status = conflictResult(result) ? 'conflict' : 'blocked'
      await updateOperation(operation.id, { status, error })
      stopped = true
      break
    }

    return { replayed, stopped }
  } finally {
    replaying = false
    updateOfflineStatus({ syncing: false })
    await refreshQueueStatus()
  }
}

function withExpectedVersion(body, version) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body
  if (typeof FormData !== 'undefined' && body instanceof FormData) return body
  return { ...body, expectedVersion: version }
}

export async function resolveConflict(id, { action, body, expectedVersion } = {}) {
  if (action === 'keep-server' || action === 'discard') {
    await deleteOperation(id)
    await refreshQueueStatus()
    return { replay: false }
  }

  const operation = await updateOperationPayload(id, {
    body: withExpectedVersion(body, expectedVersion),
  })
  if (!operation) return { replay: false }

  await updateOperation(id, { status: 'pending', error: null, attempts: 0 })
  await refreshQueueStatus()
  return { replay: true }
}

export async function discardOperation(id) {
  await deleteOperation(id)
  await refreshQueueStatus()
}
