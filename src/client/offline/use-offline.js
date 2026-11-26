import { useSyncExternalStore } from 'react'
import { resolveConflictAction, syncNow } from './manager.js'
import { getOfflineStatus, subscribeToOfflineStatus } from './status.js'

export function useOffline() {
  const status = useSyncExternalStore(subscribeToOfflineStatus, getOfflineStatus, getOfflineStatus)
  return { ...status, syncNow, resolveConflictAction }
}
