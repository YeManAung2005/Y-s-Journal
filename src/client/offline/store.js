import { offlineDb } from './db.js'
import {
  base64ToBytes,
  bytesToBase64,
  constantTimeEqual,
  decryptJson,
  deriveCacheKey,
  deriveVerifier,
  encryptJson,
  randomId,
} from './crypto.js'

let activeKey = null

export class OfflineQuotaError extends Error {
  constructor() {
    super('Browser storage is full. Pending changes were not discarded.')
    this.name = 'OfflineQuotaError'
  }
}

export function setOfflineKey(key) {
  activeKey = key
}

export function clearOfflineKey() {
  activeKey = null
}

export function isOfflineUnlocked() {
  return Boolean(activeKey)
}

function requireKey() {
  if (!activeKey) throw new Error('The offline cache is locked.')
  return activeKey
}

function guardQuota(error) {
  if (error?.name === 'QuotaExceededError' || error?.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
    return new OfflineQuotaError()
  }
  return error
}

async function blobToBase64(blob) {
  const buffer = typeof blob.arrayBuffer === 'function' ? await blob.arrayBuffer() : await blob
  return bytesToBase64(new Uint8Array(buffer))
}

async function serializeBody(body) {
  if (body === undefined || body === null) return { kind: 'none' }

  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const parts = []
    for (const [name, value] of body.entries()) {
      if (typeof Blob !== 'undefined' && value instanceof Blob) {
        parts.push({
          name,
          kind: 'file',
          filename: value.name ?? null,
          type: value.type || 'application/octet-stream',
          data: await blobToBase64(value),
        })
      } else {
        parts.push({ name, kind: 'text', value: String(value) })
      }
    }
    return { kind: 'form', parts }
  }

  return { kind: 'json', value: JSON.parse(JSON.stringify(body)) }
}

function deserializeBody(serialized) {
  if (!serialized || serialized.kind === 'none') return undefined
  if (serialized.kind === 'json') return serialized.value
  if (serialized.kind === 'form') {
    const form = new FormData()
    for (const part of serialized.parts) {
      if (part.kind === 'file') {
        const bytes = base64ToBytes(part.data)
        const blob = new Blob([bytes], { type: part.type })
        form.append(
          part.name,
          part.filename ? new File([blob], part.filename, { type: part.type }) : blob,
          part.filename ?? undefined,
        )
      } else {
        form.append(part.name, part.value)
      }
    }
    return form
  }
  throw new Error('Unsupported queued payload.')
}

async function encryptedValue(value) {
  return encryptJson(value, requireKey())
}

async function decryptedValue(record) {
  const value = await decryptJson(record, requireKey())
  if (value && typeof value === 'object' && Object.hasOwn(value, 'body')) {
    return { ...value, body: deserializeBody(value.body) }
  }
  return value
}

export async function putCachedQuery(key, value) {
  try {
    await offlineDb.cache.put({ key, ...(await encryptedValue(value)), updatedAt: Date.now() })
  } catch (error) {
    throw guardQuota(error)
  }
}

export async function getCachedQuery(key) {
  const record = await offlineDb.cache.get(key)
  return record ? decryptedValue(record) : undefined
}

export async function clearCachedQueries() {
  await offlineDb.cache.clear()
}

export async function saveOfflineProfile({ userId, email, displayName, verifier }) {
  await offlineDb.profiles.put({ userId, email, displayName, verifier, updatedAt: Date.now() })
}

export async function getOfflineProfile() {
  const profiles = await offlineDb.profiles.orderBy('updatedAt').reverse().toArray()
  return profiles[0] ?? null
}

export async function clearOfflineProfile() {
  await offlineDb.profiles.clear()
}

export async function initializeOffline({ password, userId, email, displayName }) {
  const key = await deriveCacheKey(password, userId)
  const verifier = await deriveVerifier(password, userId)
  setOfflineKey(key)
  await saveOfflineProfile({ userId, email, displayName, verifier })
  return { key, verifier }
}

export async function verifyOfflinePassword(password, profile) {
  if (!profile?.userId || !profile?.verifier) return false
  const verifier = await deriveVerifier(password, profile.userId)
  return constantTimeEqual(verifier, profile.verifier)
}

export async function unlockOffline(password, profile) {
  const valid = await verifyOfflinePassword(password, profile)
  if (!valid) return false
  setOfflineKey(await deriveCacheKey(password, profile.userId))
  return true
}

export async function rotateOfflinePassword({ currentPassword, newPassword, profile }) {
  if (!(await verifyOfflinePassword(currentPassword, profile))) return false

  const oldKey = requireKey()
  const nextKey = await deriveCacheKey(newPassword, profile.userId)
  const operations = await offlineDb.operations.toArray()
  const reencrypted = []
  for (const operation of operations) {
    const value = await decryptJson(operation, oldKey)
    reencrypted.push({ ...operation, ...(await encryptJson(value, nextKey)) })
  }

  const verifier = await deriveVerifier(newPassword, profile.userId)

  await offlineDb.transaction(
    'rw',
    offlineDb.cache,
    offlineDb.operations,
    offlineDb.profiles,
    async () => {
      await offlineDb.cache.clear()
      await offlineDb.operations.clear()
      for (const operation of reencrypted) await offlineDb.operations.put(operation)
      await offlineDb.profiles.put({
        ...profile,
        verifier,
        updatedAt: Date.now(),
      })
    },
  )

  setOfflineKey(nextKey)
  return true
}

export async function enqueueOperation({
  method,
  path,
  body,
  headers = {},
  baseSnapshot = null,
  recordId = null,
}) {
  const key = requireKey()
  const id = randomId()
  const operation = {
    id,
    sequence: Date.now(),
    status: 'pending',
    attempts: 0,
    createdAt: Date.now(),
    method,
    path,
    recordId: recordId ?? (method === 'POST' ? id : null),
    error: null,
    ...(await encryptJson(
      {
        method,
        path,
        body: await serializeBody(body),
        headers,
        baseSnapshot,
        idempotencyKey: id,
      },
      key,
    )),
  }

  try {
    await offlineDb.operations.put(operation)
  } catch (error) {
    throw guardQuota(error)
  }
  return id
}

export async function listOperations() {
  const records = await offlineDb.operations.orderBy('sequence').toArray()
  return Promise.all(
    records.map(async (record) => ({
      ...record,
      ...(await decryptedValue(record)),
    })),
  )
}

export async function getOperation(id) {
  const record = await offlineDb.operations.get(id)
  return record ? { ...record, ...(await decryptedValue(record)) } : undefined
}

export async function updateOperation(id, patch) {
  const record = await offlineDb.operations.get(id)
  if (!record) return undefined
  const next = { ...record, ...patch }
  await offlineDb.operations.put(next)
  return next
}

export async function updateOperationPayload(id, { body, headers, baseSnapshot }) {
  const record = await offlineDb.operations.get(id)
  if (!record) return undefined
  const current = await decryptedValue(record)
  const next = {
    ...record,
    ...(await encryptedValue({
      ...current,
      body: await serializeBody(body ?? current.body),
      headers: headers ?? current.headers,
      baseSnapshot: baseSnapshot === undefined ? current.baseSnapshot : baseSnapshot,
    })),
  }
  await offlineDb.operations.put(next)
  return next
}

export async function deleteOperation(id) {
  await offlineDb.operations.delete(id)
}

export async function clearOperations() {
  await offlineDb.operations.clear()
}

export async function clearOfflineData() {
  await offlineDb.transaction('rw', offlineDb.cache, offlineDb.operations, async () => {
    await offlineDb.cache.clear()
    await offlineDb.operations.clear()
  })
}
