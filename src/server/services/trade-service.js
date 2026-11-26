import { hundredthsToQuantity, microsToDollars, ticksToPrice } from '../../shared/finance/units.js'
import { canonicalizeTradeFinancials } from '../../shared/validation/trade.js'
import { ChecklistItem } from '../models/checklist-item.js'
import { Instrument } from '../models/instrument.js'
import { Tag } from '../models/tag.js'
import { Trade } from '../models/trade.js'
import { TradingAccount } from '../models/trading-account.js'
import { TradingSession } from '../models/trading-session.js'
import { HttpError } from '../lib/http-error.js'
import { calculateTrade } from './financial-engine.js'
import { listTradeScreenshots, markTradeFilesDeleted, restoreTradeFiles } from './file-service.js'

function notFound() {
  throw new HttpError(404, 'NOT_FOUND', 'The requested trade was not found.')
}

function versionConflict() {
  throw new HttpError(409, 'VERSION_CONFLICT', 'This trade changed. Reload and try again.')
}

function invalid(message) {
  throw new HttpError(400, 'VALIDATION_ERROR', message)
}

async function resolveReferences(userId, payload, existing = null) {
  const accountId = payload.accountId ?? existing?.accountId
  const instrumentId = payload.instrumentId ?? existing?.instrumentId

  const account = await TradingAccount.findOne({
    _id: accountId,
    userId,
    archivedAt: null,
  })
  if (!account) invalid('Choose an active trading account.')

  const instrument = await Instrument.findOne({ _id: instrumentId, userId, active: true })
  if (!instrument) invalid('Choose an active instrument.')

  let sessionId = existing?.sessionId ?? null
  let sessionSnapshot = existing?.sessionSnapshot ?? null
  if (Object.hasOwn(payload, 'sessionId')) {
    if (payload.sessionId === null) {
      sessionId = null
      sessionSnapshot = null
    } else {
      const record = await TradingSession.findOne({
        _id: payload.sessionId,
        userId,
        archivedAt: null,
      })
      if (!record) invalid('Choose an active trading session.')
      sessionId = record._id
      sessionSnapshot = {
        id: record._id,
        name: record.name,
        color: record.color,
      }
    }
  }

  let tagIds = existing?.tagIds ?? []
  let tagSnapshots = existing?.tags ?? []
  if (payload.tagIds !== undefined) {
    tagIds = payload.tagIds
    const records = await Tag.find({
      _id: { $in: payload.tagIds },
      userId,
      archivedAt: null,
    })
    if (records.length !== payload.tagIds.length) invalid('One or more tags are unavailable.')
    tagSnapshots = records.map((tag) => ({
      id: tag._id,
      type: tag.type,
      name: tag.name,
      slug: tag.slug,
      color: tag.color,
    }))
  }

  let checklistSnapshot = existing?.checklist ?? []
  if (payload.checklist !== undefined) {
    const records = await ChecklistItem.find({
      _id: { $in: payload.checklist.map((item) => item.itemId) },
      userId,
      archivedAt: null,
    })
    if (records.length !== payload.checklist.length) {
      invalid('One or more checklist items are unavailable.')
    }
    const byId = new Map(records.map((item) => [item._id.toString(), item]))
    checklistSnapshot = payload.checklist.map((answer) => {
      const item = byId.get(answer.itemId)
      return {
        itemId: item._id,
        text: item.text,
        checked: answer.checked,
      }
    })
  }

  return {
    accountId: account._id,
    accountSnapshot: {
      id: account._id,
      name: account.name,
      broker: account.broker,
      accountType: account.accountType,
      startingBalanceMicros: account.startingBalanceMicros,
    },
    instrumentId: instrument._id,
    instrumentSnapshot: {
      id: instrument._id,
      symbol: instrument.symbol,
      name: instrument.name,
      pointValueMicros: instrument.pointValueMicros,
      tickValueMicros: instrument.tickValueMicros,
      tickSizeMicros: instrument.tickSizeMicros,
    },
    sessionId,
    sessionSnapshot,
    tagIds,
    tagSnapshots,
    checklistSnapshot,
  }
}

function financialValuesFromTrade(trade, spec, payload) {
  const field = (name, fallback) => (payload[name] === undefined ? fallback : payload[name])

  return {
    direction: field('direction', trade?.direction),
    entryPrice: field(
      'entryPrice',
      trade ? ticksToPrice(trade.entryPriceTicks, spec.tickSizeMicros) : undefined,
    ),
    quantity: field('quantity', trade ? hundredthsToQuantity(trade.quantityHundredths) : undefined),
    exits: field(
      'exits',
      trade
        ? trade.exits.map((exit) => ({
            price: exit.price,
            quantity: hundredthsToQuantity(exit.quantityHundredths),
          }))
        : undefined,
    ),
    fees: field(
      'fees',
      trade ? (trade.feesMicros === null ? null : microsToDollars(trade.feesMicros)) : null,
    ),
    initialStopPrice: field(
      'initialStopPrice',
      trade
        ? trade.initialStopPriceTicks === null
          ? null
          : ticksToPrice(trade.initialStopPriceTicks, spec.tickSizeMicros)
        : null,
    ),
    manualRisk: field(
      'manualRisk',
      trade
        ? trade.manualRiskMicros === null
          ? null
          : microsToDollars(trade.manualRiskMicros)
        : null,
    ),
  }
}

function computeTrade(payload, instrumentSnapshot) {
  let financialInput
  let calculation
  try {
    financialInput = canonicalizeTradeFinancials(payload, instrumentSnapshot)
    calculation = calculateTrade({
      direction: financialInput.direction,
      instrument: {
        tickValueMicros: instrumentSnapshot.tickValueMicros,
        tickSizeMicros: instrumentSnapshot.tickSizeMicros,
      },
      entryPriceTicks: financialInput.entryPriceTicks,
      quantityHundredths: financialInput.quantityHundredths,
      exits: financialInput.exits,
      feesMicros: financialInput.feesMicros,
      initialStopPriceTicks: financialInput.initialStopPriceTicks,
      manualRiskMicros: financialInput.manualRiskMicros,
    })
  } catch (error) {
    invalid(error instanceof Error ? error.message : 'The trade could not be calculated.')
  }

  return { financialInput, calculation }
}

function calculationFields(calculation) {
  return {
    exits: calculation.exits.map((exit) => ({
      priceTicks: exit.priceTicks,
      price: exit.price,
      quantityHundredths: exit.quantityHundredths,
      grossPnlMicros: exit.grossPnlMicros,
      allocatedFeeMicros: exit.allocatedFeeMicros,
      netPnlMicros: exit.netPnlMicros,
    })),
    initialStopPriceTicks: calculation.initialStopPriceTicks,
    feesMicros: calculation.feesMicros,
    manualRiskMicros: calculation.manualRiskMicros,
    automaticRiskMicros: calculation.automaticRiskMicros,
    selectedRiskMicros: calculation.selectedRiskMicros,
    grossPnlMicros: calculation.grossPnlMicros,
    netPnlMicros: calculation.netPnlMicros,
    grossR: calculation.grossR,
    weightedAverageExitTicks: calculation.weightedAverageExitTicks,
    weightedAverageExitPrice: calculation.weightedAverageExitPrice,
    outcomeGross: calculation.outcomeGross,
    outcomeNet: calculation.outcomeNet,
    formulaVersion: calculation.formulaVersion,
    calculatedAt: new Date(calculation.calculatedAt),
  }
}

function buildTradeFields(userId, payload, references, calculation, existing = null) {
  const field = (name, fallback) => (payload[name] === undefined ? fallback : payload[name])
  const review = field('review', existing?.review ?? {})

  return {
    userId,
    accountId: references.accountId,
    accountSnapshot: references.accountSnapshot,
    instrumentId: references.instrumentId,
    instrumentSnapshot: references.instrumentSnapshot,
    direction: calculation.direction,
    entryPriceTicks: calculation.entryPriceTicks,
    quantityHundredths: calculation.quantityHundredths,
    tradeDate: field('tradeDate', existing?.tradeDate),
    sessionId: references.sessionId,
    sessionSnapshot: references.sessionSnapshot,
    tagIds: references.tagIds,
    tags: references.tagSnapshots,
    checklist: references.checklistSnapshot,
    emotions: field('emotions', existing?.emotions ?? []),
    ruleViolations: field('ruleViolations', existing?.ruleViolations ?? []),
    notes: field('notes', existing?.notes ?? ''),
    lessons: field('lessons', existing?.lessons ?? ''),
    review: {
      followedPlan: review.followedPlan ?? null,
      whatWentWell: review.whatWentWell ?? '',
      whatToImprove: review.whatToImprove ?? '',
      confidence: review.confidence ?? null,
      reviewedAt: review.reviewedAt ?? null,
    },
    ...calculationFields(calculation),
  }
}

export async function serializeTrade(trade) {
  const screenshots = await listTradeScreenshots(trade.userId, trade._id)
  const spec = trade.instrumentSnapshot

  return {
    id: trade._id.toString(),
    accountId: trade.accountId.toString(),
    accountSnapshot: trade.accountSnapshot,
    instrumentId: trade.instrumentId.toString(),
    instrumentSnapshot: trade.instrumentSnapshot,
    direction: trade.direction,
    tradeDate: trade.tradeDate,
    entryPriceTicks: trade.entryPriceTicks,
    entryPrice: ticksToPrice(trade.entryPriceTicks, spec.tickSizeMicros),
    quantityHundredths: trade.quantityHundredths,
    quantity: hundredthsToQuantity(trade.quantityHundredths),
    sessionId: trade.sessionId?.toString() ?? null,
    sessionSnapshot: trade.sessionSnapshot,
    initialStopPriceTicks: trade.initialStopPriceTicks,
    initialStopPrice:
      trade.initialStopPriceTicks === null
        ? null
        : ticksToPrice(trade.initialStopPriceTicks, spec.tickSizeMicros),
    exits: trade.exits.map((exit) => ({
      priceTicks: exit.priceTicks,
      price: exit.price,
      quantityHundredths: exit.quantityHundredths,
      quantity: hundredthsToQuantity(exit.quantityHundredths),
      grossPnlMicros: exit.grossPnlMicros,
      allocatedFeeMicros: exit.allocatedFeeMicros,
      netPnlMicros: exit.netPnlMicros,
    })),
    feesMicros: trade.feesMicros,
    fees: trade.feesMicros === null ? null : microsToDollars(trade.feesMicros),
    manualRiskMicros: trade.manualRiskMicros,
    manualRisk: trade.manualRiskMicros === null ? null : microsToDollars(trade.manualRiskMicros),
    automaticRiskMicros: trade.automaticRiskMicros,
    selectedRiskMicros: trade.selectedRiskMicros,
    grossPnlMicros: trade.grossPnlMicros,
    netPnlMicros: trade.netPnlMicros,
    grossR: trade.grossR,
    weightedAverageExitTicks: trade.weightedAverageExitTicks,
    weightedAverageExitPrice: trade.weightedAverageExitPrice,
    outcomeGross: trade.outcomeGross,
    outcomeNet: trade.outcomeNet,
    formulaVersion: trade.formulaVersion,
    calculatedAt: trade.calculatedAt,
    tagIds: trade.tagIds.map((id) => id.toString()),
    tags: trade.tags,
    checklist: trade.checklist,
    emotions: trade.emotions,
    ruleViolations: trade.ruleViolations,
    notes: trade.notes,
    lessons: trade.lessons,
    review: trade.review,
    screenshots,
    version: trade.version,
    deletedAt: trade.deletedAt,
    createdAt: trade.createdAt,
    updatedAt: trade.updatedAt,
  }
}

export async function createTrade(userId, payload) {
  const references = await resolveReferences(userId, payload)
  const { financialInput, calculation } = computeTrade(payload, references.instrumentSnapshot)
  const fields = buildTradeFields(userId, payload, references, calculation)

  const trade = await Trade.create({
    ...fields,
    direction: financialInput.direction,
    version: 0,
  })

  return serializeTrade(trade)
}

export async function listTrades(userId, query) {
  const filter = { userId }
  if (!query.includeDeleted) filter.deletedAt = null
  if (query.accountId) filter.accountId = query.accountId
  if (query.instrumentId) filter.instrumentId = query.instrumentId
  if (query.outcome) filter.outcomeGross = query.outcome
  if (query.from || query.to) {
    filter.tradeDate = {}
    if (query.from) filter.tradeDate.$gte = query.from
    if (query.to) filter.tradeDate.$lte = query.to
  }

  const trades = await Trade.find(filter).sort({ tradeDate: -1, createdAt: -1 }).limit(query.limit)

  return Promise.all(trades.map(serializeTrade))
}

export async function getTrade(userId, tradeId) {
  const trade = await Trade.findOne({ _id: tradeId, userId, deletedAt: null })
  if (!trade) notFound()
  return serializeTrade(trade)
}

export async function updateTrade(userId, tradeId, payload) {
  const existing = await Trade.findOne({ _id: tradeId, userId, deletedAt: null })
  if (!existing) notFound()

  const references = await resolveReferences(userId, payload, existing)
  const financialPayload = financialValuesFromTrade(
    existing,
    references.instrumentSnapshot,
    payload,
  )
  const { calculation } = computeTrade(financialPayload, references.instrumentSnapshot)
  const fields = buildTradeFields(userId, payload, references, calculation, existing)

  const result = await Trade.updateOne(
    { _id: tradeId, userId, version: payload.expectedVersion, deletedAt: null },
    { $set: { ...fields, version: payload.expectedVersion + 1 } },
  )
  if (result.matchedCount === 0) versionConflict()

  return getTrade(userId, tradeId)
}

export async function deleteTrade(userId, tradeId, expectedVersion) {
  const trade = await Trade.findOne({ _id: tradeId, userId, deletedAt: null })
  if (!trade) notFound()

  const result = await Trade.updateOne(
    { _id: tradeId, userId, version: expectedVersion, deletedAt: null },
    { $set: { deletedAt: new Date(), deletedBy: userId, version: expectedVersion + 1 } },
  )
  if (result.matchedCount === 0) versionConflict()

  await markTradeFilesDeleted(userId, tradeId, userId)
  const deleted = await Trade.findOne({ _id: tradeId, userId })
  return serializeTrade(deleted)
}

export async function restoreTrade(userId, tradeId, expectedVersion) {
  const trade = await Trade.findOne({ _id: tradeId, userId, deletedAt: { $ne: null } })
  if (!trade) notFound()

  const result = await Trade.updateOne(
    { _id: tradeId, userId, version: expectedVersion, deletedAt: { $ne: null } },
    {
      $set: {
        deletedAt: null,
        deletedBy: null,
        version: expectedVersion + 1,
      },
    },
  )
  if (result.matchedCount === 0) versionConflict()

  await restoreTradeFiles(userId, tradeId)

  const restored = await Trade.findOne({ _id: tradeId, userId })
  return serializeTrade(restored)
}
