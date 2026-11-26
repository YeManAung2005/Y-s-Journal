const listeners = new Set()

let snapshot = {
  online: typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  unlocked: false,
  pending: 0,
  conflicts: 0,
  blocked: 0,
  syncing: false,
  quotaError: null,
}

export function subscribeToOfflineStatus(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getOfflineStatus() {
  return snapshot
}

export function updateOfflineStatus(patch) {
  snapshot = { ...snapshot, ...patch }
  for (const listener of listeners) listener()
}
