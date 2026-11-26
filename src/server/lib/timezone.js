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

/** Returns the calendar date in an IANA time zone as YYYY-MM-DD. */
export function dateInTimeZone(date, timeZone = DEFAULT_APP_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function todayInTimeZone(timeZone = DEFAULT_APP_TIME_ZONE, now = new Date()) {
  return dateInTimeZone(now, timeZone)
}
