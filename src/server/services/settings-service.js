import { Settings } from '../models/settings.js'

export async function getOrCreateSettings(userId) {
  const existing = await Settings.findOne({ userId })
  if (existing) return existing

  try {
    return await Settings.create({ userId })
  } catch (error) {
    if (error?.code === 11000) {
      return Settings.findOne({ userId })
    }
    throw error
  }
}

export async function updateSettings(userId, patch) {
  const settings = await getOrCreateSettings(userId)

  for (const [key, value] of Object.entries(patch)) {
    if (key === 'reminders' && value && typeof value === 'object') {
      settings.reminders = { ...settings.reminders, ...value }
      continue
    }
    settings[key] = value
  }

  await settings.save()
  return settings
}

export function serializeSettings(settings) {
  return {
    id: settings._id.toString(),
    theme: settings.theme,
    fontScale: settings.fontScale,
    reducedMotion: settings.reducedMotion,
    appTimeZone: settings.appTimeZone,
    tradingTimeZone: settings.tradingTimeZone,
    dailyStudyTargetMinutes: settings.dailyStudyTargetMinutes,
    calendarJournalIndicator: settings.calendarJournalIndicator,
    storageLimitBytes: settings.storageLimitBytes,
    reminders: settings.reminders,
    updatedAt: settings.updatedAt,
  }
}
