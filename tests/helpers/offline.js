import 'fake-indexeddb/auto'
import { webcrypto } from 'node:crypto'
import { offlineDb } from '../../src/client/offline/db.js'
import { clearOfflineKey } from '../../src/client/offline/store.js'
import { updateOfflineStatus } from '../../src/client/offline/status.js'

Object.defineProperty(globalThis, 'crypto', {
  value: webcrypto,
  configurable: true,
  writable: true,
})

export function setOnline(value) {
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: value },
    configurable: true,
    writable: true,
  })
}

export async function resetOfflineDb() {
  clearOfflineKey()
  await offlineDb.open()
  await Promise.all(offlineDb.tables.map((table) => table.clear()))
  updateOfflineStatus({
    online: true,
    unlocked: false,
    pending: 0,
    conflicts: 0,
    blocked: 0,
    syncing: false,
    quotaError: null,
  })
}
