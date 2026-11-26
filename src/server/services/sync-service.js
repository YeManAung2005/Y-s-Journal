import { HttpError } from '../lib/http-error.js'
import { AccountAdjustment } from '../models/account-adjustment.js'
import { ChecklistItem } from '../models/checklist-item.js'
import { DashboardLayout } from '../models/dashboard-layout.js'
import { FileRecord } from '../models/file.js'
import { Instrument } from '../models/instrument.js'
import { JournalEntry } from '../models/journal-entry.js'
import { LearningCategory } from '../models/learning-category.js'
import { LearningGoal } from '../models/learning-goal.js'
import { LearningRecord } from '../models/learning-record.js'
import { PosterConfig } from '../models/poster-config.js'
import { QuickNote } from '../models/quick-note.js'
import { SyncOperation } from '../models/sync-operation.js'
import { Tag } from '../models/tag.js'
import { Trade } from '../models/trade.js'
import { TradingAccount } from '../models/trading-account.js'
import { TradingSession } from '../models/trading-session.js'

export const SYNC_RESOURCE_TYPES = Object.freeze({
  trades: Trade,
  accounts: TradingAccount,
  instruments: Instrument,
  tags: Tag,
  sessions: TradingSession,
  checklist: ChecklistItem,
  adjustments: AccountAdjustment,
  journalEntries: JournalEntry,
  quickNotes: QuickNote,
  learningCategories: LearningCategory,
  learningRecords: LearningRecord,
  learningGoals: LearningGoal,
  dashboardLayouts: DashboardLayout,
  posterConfigs: PosterConfig,
  files: FileRecord,
})

export async function getSyncResource(userId, type, id) {
  const Model = SYNC_RESOURCE_TYPES[type]
  if (!Model) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'That resource type cannot be synchronized.')
  }

  const resource = await Model.findOne({ _id: id, userId, deletedAt: null }).lean()
  if (!resource) {
    throw new HttpError(404, 'NOT_FOUND', 'The requested resource was not found.')
  }

  const result = { ...resource, id: resource._id.toString() }
  delete result._id
  delete result.userId
  delete result.__v
  return result
}

export async function findSyncOperation(userId, key) {
  return SyncOperation.findOne({ userId, key }).lean()
}

export async function beginSyncOperation(userId, key, method, path) {
  try {
    await SyncOperation.create({ userId, key, method, path, status: 'pending' })
    return null
  } catch (error) {
    if (error?.code !== 11000) throw error
    return findSyncOperation(userId, key)
  }
}

export async function completeSyncOperation(userId, key, statusCode, response) {
  await SyncOperation.updateOne(
    { userId, key, status: 'pending' },
    {
      $set: {
        status: 'completed',
        statusCode,
        response,
        error: null,
        completedAt: new Date(),
      },
    },
  )
}

export async function failSyncOperation(userId, key, error) {
  await SyncOperation.deleteOne({
    userId,
    key,
    status: 'pending',
  })
  return error
}
