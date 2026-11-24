import mongoose from 'mongoose'
import { DEFAULT_APP_TIME_ZONE, DEFAULT_TRADING_TIME_ZONE } from '../lib/timezone.js'

const settingsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    theme: { type: String, enum: ['dark', 'light', 'system'], default: 'dark' },
    fontScale: { type: Number, default: 1, min: 0.8, max: 1.5 },
    reducedMotion: { type: Boolean, default: false },
    appTimeZone: { type: String, default: DEFAULT_APP_TIME_ZONE },
    tradingTimeZone: { type: String, default: DEFAULT_TRADING_TIME_ZONE },
    dailyStudyTargetMinutes: { type: Number, default: 60, min: 0, max: 720 },
    storageLimitBytes: { type: Number, default: 5 * 1024 * 1024 * 1024, min: 0 },
    reminders: {
      journalEnabled: { type: Boolean, default: false },
      journalTime: { type: String, default: '20:00' },
      backupEnabled: { type: Boolean, default: true },
    },
  },
  { timestamps: true },
)

settingsSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v
    return ret
  },
})

export const Settings = mongoose.models.Settings ?? mongoose.model('Settings', settingsSchema)
