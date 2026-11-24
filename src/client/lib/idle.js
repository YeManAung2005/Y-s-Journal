export const AUTO_LOCK_MS = 15 * 60 * 1000
export const IDLE_CHECK_INTERVAL_MS = 30 * 1000

export function isIdleExpired(lastActivityAt, now = Date.now(), limit = AUTO_LOCK_MS) {
  if (!Number.isFinite(lastActivityAt) || !Number.isFinite(now)) return false
  return now - lastActivityAt >= limit
}
