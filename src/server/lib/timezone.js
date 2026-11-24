export const DEFAULT_APP_TIME_ZONE = 'Asia/Yangon'
export const DEFAULT_TRADING_TIME_ZONE = 'America/New_York'

export function isValidTimeZone(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date())
    return true
  } catch {
    return false
  }
}
