import { microsToDollars } from '../../shared/finance/units.js'
import { canonicalizeAdjustmentAmount } from '../../shared/validation/account-adjustment.js'
import { AccountAdjustment } from '../models/account-adjustment.js'
import { TradingAccount } from '../models/trading-account.js'
import { HttpError } from '../lib/http-error.js'

function notFound() {
  throw new HttpError(404, 'NOT_FOUND', 'The requested adjustment was not found.')
}

function versionConflict() {
  throw new HttpError(409, 'VERSION_CONFLICT', 'This adjustment changed. Reload and try again.')
}

function invalid(message) {
  throw new HttpError(400, 'VALIDATION_ERROR', message)
}

export function serializeAdjustment(adjustment) {
  return {
    id: adjustment._id.toString(),
    accountId: adjustment.accountId.toString(),
    type: adjustment.type,
    signedAmountMicros: adjustment.signedAmountMicros,
    amount: microsToDollars(adjustment.signedAmountMicros),
    date: adjustment.date,
    note: adjustment.note,
    version: adjustment.version,
    deletedAt: adjustment.deletedAt,
    createdAt: adjustment.createdAt,
    updatedAt: adjustment.updatedAt,
  }
}

export async function listAdjustments(userId, query = {}) {
  const filter = { userId, deletedAt: null }
  if (query.accountId) filter.accountId = query.accountId
  if (query.from || query.to) {
    filter.date = {}
    if (query.from) filter.date.$gte = query.from
    if (query.to) filter.date.$lte = query.to
  }

  const adjustments = await AccountAdjustment.find(filter).sort({ date: -1, createdAt: -1 })
  return adjustments.map(serializeAdjustment)
}

export async function createAdjustment(userId, payload) {
  const account = await TradingAccount.findOne({
    _id: payload.accountId,
    userId,
    archivedAt: null,
  })
  if (!account) invalid('Choose an active trading account.')

  let signedAmountMicros
  try {
    signedAmountMicros = canonicalizeAdjustmentAmount(payload)
  } catch (error) {
    invalid(error instanceof Error ? error.message : 'Invalid adjustment amount.')
  }

  const adjustment = await AccountAdjustment.create({
    userId,
    accountId: account._id,
    type: payload.type,
    signedAmountMicros,
    date: payload.date,
    note: payload.note,
    version: 0,
  })

  return serializeAdjustment(adjustment)
}

export async function deleteAdjustment(userId, adjustmentId, expectedVersion) {
  const adjustment = await AccountAdjustment.findOne({
    _id: adjustmentId,
    userId,
    deletedAt: null,
  })
  if (!adjustment) notFound()

  const result = await AccountAdjustment.updateOne(
    { _id: adjustmentId, userId, version: expectedVersion, deletedAt: null },
    {
      $set: {
        deletedAt: new Date(),
        deletedBy: userId,
        version: expectedVersion + 1,
      },
    },
  )
  if (result.matchedCount === 0) versionConflict()

  return serializeAdjustment(await AccountAdjustment.findOne({ _id: adjustmentId, userId }))
}
