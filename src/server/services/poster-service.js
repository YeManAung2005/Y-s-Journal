import Decimal from 'decimal.js'
import { ticksToPrice } from '../../shared/finance/units.js'
import { HttpError } from '../lib/http-error.js'
import { todayInTimeZone } from '../lib/timezone.js'
import { PosterConfig } from '../models/poster-config.js'
import { Trade } from '../models/trade.js'
import { getSummary } from './analytics-service.js'
import { getLearningSummary } from './learning-service.js'
import { getOrCreateSettings } from './settings-service.js'

export const POSTER_TYPES = [
  {
    id: 'trading',
    label: 'Trading performance',
    description: 'P&L, win rate, and average R for the selected period.',
  },
  {
    id: 'learning',
    label: 'Study momentum',
    description: 'Study time, active days, and streaks for the selected period.',
  },
  {
    id: 'trade',
    label: 'Single trade ROI',
    description: 'ROI on risk, P&L, R multiple, and risk for one completed trade.',
  },
]

export const POSTER_TEMPLATES = [
  {
    id: 'midnight',
    label: 'Midnight',
    description: 'Deep charcoal with a luminous accent.',
    palette: {
      background: '#09090b',
      foreground: '#f4f4f5',
      muted: '#a1a1aa',
      panel: '#15151b',
      border: '#2b2b36',
      glow: '#8b5cf6',
    },
  },
  {
    id: 'paper',
    label: 'Paper',
    description: 'Warm, editorial light layout.',
    palette: {
      background: '#f6f3ec',
      foreground: '#1c1917',
      muted: '#78716c',
      panel: '#ffffff',
      border: '#e4ded2',
      glow: '#b45309',
    },
  },
  {
    id: 'ember',
    label: 'Ember',
    description: 'Dark roast tones with a warm accent.',
    palette: {
      background: '#180d08',
      foreground: '#fff7ed',
      muted: '#c9a99a',
      panel: '#26150e',
      border: '#4b2b1c',
      glow: '#f97316',
    },
  },
]

export const POSTER_DIMENSIONS = [
  { id: 'square', label: 'Square', width: 1080, height: 1080 },
  { id: 'portrait', label: 'Portrait', width: 1080, height: 1350 },
  { id: 'story', label: 'Story', width: 1080, height: 1920 },
]

export const POSTER_DEFAULTS = {
  type: 'trading',
  template: 'midnight',
  dimension: 'square',
  accentColor: '#8b5cf6',
  logoPosition: 'top-left',
  days: 30,
  basis: 'gross',
}

function conflict(message) {
  throw new HttpError(409, 'CONFLICT', message)
}

function notFound(message = 'The requested poster was not found.') {
  throw new HttpError(404, 'NOT_FOUND', message)
}

function staleVersion() {
  throw new HttpError(409, 'VERSION_CONFLICT', 'This poster changed. Reload and try again.')
}

function shiftDate(date, days) {
  const [year, month, day] = date.split('-').map(Number)
  const result = new Date(Date.UTC(year, month - 1, day + days))
  return result.toISOString().slice(0, 10)
}

function formatTradeDate(date) {
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function decimalRatio(numeratorMicros, denominatorMicros) {
  if (numeratorMicros === null || denominatorMicros === null || denominatorMicros <= 0) {
    return null
  }
  return new Decimal(numeratorMicros).div(denominatorMicros).toSignificantDigits(12).toString()
}

async function assertTradeReference(userId, type, tradeId) {
  if (type !== 'trade') return
  if (!tradeId) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Choose a completed trade for a trade poster.')
  }
  const exists = await Trade.exists({ _id: tradeId, userId, deletedAt: null })
  if (!exists) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Choose an available completed trade.')
  }
}

function serializeConfig(config) {
  return {
    id: config._id.toString(),
    name: config.name,
    type: config.type,
    template: config.template,
    dimension: config.dimension,
    accentColor: config.accentColor,
    headline: config.headline,
    subtitle: config.subtitle,
    footer: config.footer,
    logoPosition: config.logoPosition,
    days: config.days,
    basis: config.basis,
    tradeId: config.tradeId?.toString() ?? null,
    version: config.version,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
  }
}

export function getPosterCatalog() {
  return {
    types: POSTER_TYPES,
    templates: POSTER_TEMPLATES,
    dimensions: POSTER_DIMENSIONS,
    defaults: POSTER_DEFAULTS,
  }
}

export async function listPosterConfigs(userId) {
  const configs = await PosterConfig.find({ userId }).sort({ updatedAt: -1, name: 1 })
  return configs.map(serializeConfig)
}

export async function createPosterConfig(userId, payload) {
  if (await PosterConfig.exists({ userId, name: payload.name })) {
    conflict('A poster with that name already exists.')
  }
  await assertTradeReference(userId, payload.type, payload.tradeId)

  let config
  try {
    config = await PosterConfig.create({ userId, ...payload, version: 0 })
  } catch (error) {
    if (error?.code === 11000) conflict('A poster with that name already exists.')
    throw error
  }

  return serializeConfig(await PosterConfig.findOne({ _id: config._id, userId }))
}

export async function updatePosterConfig(userId, configId, payload) {
  const existing = await PosterConfig.findOne({ _id: configId, userId })
  if (!existing) notFound()

  if (
    payload.name &&
    (await PosterConfig.exists({ userId, name: payload.name, _id: { $ne: configId } }))
  ) {
    conflict('A poster with that name already exists.')
  }

  const nextType = payload.type ?? existing.type
  const nextTradeId =
    payload.tradeId !== undefined ? payload.tradeId : (existing.tradeId?.toString() ?? null)
  await assertTradeReference(userId, nextType, nextTradeId)

  const set = {}
  for (const field of [
    'name',
    'type',
    'template',
    'dimension',
    'accentColor',
    'headline',
    'subtitle',
    'footer',
    'logoPosition',
    'days',
    'basis',
    'tradeId',
  ]) {
    if (payload[field] !== undefined) set[field] = payload[field]
  }
  if (nextType !== 'trade') set.tradeId = null

  const result = await PosterConfig.updateOne(
    { _id: configId, userId, version: payload.expectedVersion },
    { $set: set, $inc: { version: 1 } },
  )
  if (result.matchedCount === 0) {
    if (!(await PosterConfig.exists({ _id: configId, userId }))) notFound()
    staleVersion()
  }

  return serializeConfig(await PosterConfig.findOne({ _id: configId, userId }))
}

export async function deletePosterConfig(userId, configId, expectedVersion) {
  const config = await PosterConfig.findOne({ _id: configId, userId })
  if (!config) notFound()

  const result = await PosterConfig.deleteOne({
    _id: configId,
    userId,
    version: expectedVersion,
  })
  if (result.deletedCount === 0) staleVersion()
  return serializeConfig(config)
}

export async function getPosterData(userId, query) {
  const settings = await getOrCreateSettings(userId)
  const today = todayInTimeZone(settings.appTimeZone)
  const from = shiftDate(today, -(query.days - 1))

  if (query.type === 'trade') {
    const trade = await Trade.findOne({ _id: query.tradeId, userId, deletedAt: null })
    if (!trade) throw new HttpError(404, 'NOT_FOUND', 'The selected trade was not found.')

    const basisLabel = query.basis === 'net' ? 'Net' : 'Gross'
    const selectedPnlMicros = query.basis === 'net' ? trade.netPnlMicros : trade.grossPnlMicros
    const riskMicros = trade.selectedRiskMicros
    const roiRatio = decimalRatio(selectedPnlMicros, riskMicros)
    const rMultiple =
      query.basis === 'net' ? decimalRatio(selectedPnlMicros, riskMicros) : trade.grossR
    const entryPrice = ticksToPrice(trade.entryPriceTicks, trade.instrumentSnapshot.tickSizeMicros)
    const directionLabel = trade.direction === 'long' ? 'Long' : 'Short'
    const quantity = new Decimal(trade.quantityHundredths).div(100).toString()

    let note = null
    if (query.basis === 'net' && trade.netPnlMicros === null) {
      note = 'Net P&L is unavailable because fees are missing.'
    } else if (roiRatio === null) {
      note = 'ROI is unavailable because this trade has no risk value.'
    }

    return {
      type: 'trade',
      from: trade.tradeDate,
      to: trade.tradeDate,
      days: 1,
      basis: query.basis,
      title: `${trade.instrumentSnapshot.symbol} ${directionLabel}`,
      subtitle: `${formatTradeDate(trade.tradeDate)} · Entry ${entryPrice} → Exit ${
        trade.weightedAverageExitPrice
      } · ${quantity} qty`,
      metrics: [
        { id: 'roi', label: 'ROI on risk', kind: 'percent', value: roiRatio },
        {
          id: 'pnl',
          label: `${basisLabel} P&L`,
          kind: 'money',
          value: selectedPnlMicros,
        },
        { id: 'r', label: 'R multiple', kind: 'multiple', value: rMultiple },
        { id: 'risk', label: 'Risked', kind: 'money', value: riskMicros },
      ],
      note,
      trade: {
        id: trade._id.toString(),
        symbol: trade.instrumentSnapshot.symbol,
        direction: trade.direction,
        tradeDate: trade.tradeDate,
        entryPrice,
        exitPrice: trade.weightedAverageExitPrice,
        quantity,
        accountName: trade.accountSnapshot.name,
      },
    }
  }

  if (query.type === 'learning') {
    const summary = await getLearningSummary(
      userId,
      { from, to: today },
      {
        dailyTargetMinutes: settings.dailyStudyTargetMinutes,
        today,
      },
    )

    return {
      type: 'learning',
      from,
      to: today,
      days: query.days,
      basis: null,
      title: 'Study momentum',
      metrics: [
        { id: 'minutes', label: 'Study time', kind: 'minutes', value: summary.totalMinutes },
        { id: 'activeDays', label: 'Active days', kind: 'integer', value: summary.activeDays },
        {
          id: 'currentStreak',
          label: 'Current streak',
          kind: 'days',
          value: summary.currentStreak,
        },
        {
          id: 'longestStreak',
          label: 'Longest streak',
          kind: 'days',
          value: summary.longestStreak,
        },
      ],
      note: null,
    }
  }

  const summary = await getSummary(userId, { basis: query.basis, from, to: today })
  const basisLabel = query.basis === 'net' ? 'Net' : 'Gross'

  return {
    type: 'trading',
    from,
    to: today,
    days: query.days,
    basis: query.basis,
    title: 'Trading performance',
    metrics: [
      { id: 'trades', label: 'Trades', kind: 'integer', value: summary.tradeCount },
      {
        id: 'pnl',
        label: `${basisLabel} P&L`,
        kind: 'money',
        value: summary.totalPnlMicros,
      },
      { id: 'winRate', label: 'Win rate', kind: 'percent', value: summary.winRate },
      { id: 'averageR', label: 'Average R', kind: 'multiple', value: summary.averageR },
    ],
    note:
      query.basis === 'net' && !summary.coverage?.netComplete
        ? 'Net P&L is unavailable because some fees are missing.'
        : null,
  }
}
