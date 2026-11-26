import Decimal from 'decimal.js'
import { assertSafeInteger } from '../../shared/finance/units.js'
import { AccountAdjustment } from '../models/account-adjustment.js'
import { Trade } from '../models/trade.js'
import { TradingAccount } from '../models/trading-account.js'
import { HttpError } from '../lib/http-error.js'
import { classifyPnl } from './financial-engine.js'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function safeBigIntToNumber(value, label) {
  return assertSafeInteger(Number(value), label)
}

function sumMicros(values, label) {
  const total = values.reduce((sum, value) => sum + BigInt(value), 0n)
  return safeBigIntToNumber(total, label)
}

function averageMicros(totalMicros, count, label) {
  const average = new Decimal(totalMicros).div(count).toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
  return safeBigIntToNumber(BigInt(average.toFixed(0)), label)
}

function decimalString(value) {
  return new Decimal(value).toSignificantDigits(12).toString()
}

function ratio(numerator, denominator) {
  if (denominator === 0) return null
  return decimalString(new Decimal(numerator).div(denominator))
}

function profitFactor(positiveMicros, negativeMicros) {
  if (negativeMicros === 0) return positiveMicros > 0 ? 'Infinity' : null
  if (positiveMicros === 0) return '0'
  return decimalString(new Decimal(positiveMicros).div(negativeMicros))
}

function buildTradeFilter(
  userId,
  query,
  { from = query.from, to = query.to, ignoreOutcome = false } = {},
) {
  const filter = { userId, deletedAt: null }

  if (query.accountId) filter.accountId = query.accountId
  if (query.instrumentId) filter.instrumentId = query.instrumentId
  if (query.sessionId) filter.sessionId = query.sessionId
  if (query.tagId) filter.tagIds = query.tagId
  if (query.direction) filter.direction = query.direction

  if (!ignoreOutcome && query.outcome) {
    if (query.basis === 'net') {
      filter.netPnlMicros = { $ne: null }
      filter.outcomeNet = query.outcome
    } else {
      filter.outcomeGross = query.outcome
    }
  }

  if (from || to) {
    filter.tradeDate = {}
    if (from) filter.tradeDate.$gte = from
    if (to) filter.tradeDate.$lte = to
  }

  return filter
}

async function findTrades(userId, query, options = {}) {
  return Trade.find(buildTradeFilter(userId, query, options))
    .sort({ tradeDate: 1, createdAt: 1, _id: 1 })
    .lean()
}

function selectedValue(trade, basis) {
  if (basis === 'net') {
    return trade.netPnlMicros === null ? null : trade.netPnlMicros
  }
  return trade.grossPnlMicros
}

function outcomeForPnl(pnlMicros) {
  return pnlMicros === null ? null : classifyPnl(pnlMicros)
}

function calculateStreaks(values) {
  let currentWinning = 0
  let currentLosing = 0
  let longestWinning = 0
  let longestLosing = 0

  for (const pnlMicros of values) {
    const outcome = outcomeForPnl(pnlMicros)
    if (outcome === 'win') {
      currentWinning += 1
      currentLosing = 0
      longestWinning = Math.max(longestWinning, currentWinning)
    } else if (outcome === 'loss') {
      currentLosing += 1
      currentWinning = 0
      longestLosing = Math.max(longestLosing, currentLosing)
    } else {
      currentWinning = 0
      currentLosing = 0
    }
  }

  return {
    currentWinningStreak: currentWinning,
    currentLosingStreak: currentLosing,
    longestWinningStreak: longestWinning,
    longestLosingStreak: longestLosing,
  }
}

function calculateDrawdown(trades, values) {
  if (trades.length === 0) {
    return {
      maxDrawdownMicros: 0,
      peakCumulativeMicros: 0,
      troughCumulativeMicros: 0,
      peakDate: null,
      troughDate: null,
    }
  }

  let cumulative = 0n
  let peak = 0n
  let peakDate = null
  let maxDrawdown = 0n
  let drawdownPeak = 0n
  let trough = 0n
  let troughDate = null

  trades.forEach((trade, index) => {
    cumulative += BigInt(values[index])
    if (cumulative > peak) {
      peak = cumulative
      peakDate = trade.tradeDate
    }

    const decline = peak - cumulative
    if (decline > maxDrawdown) {
      maxDrawdown = decline
      drawdownPeak = peak
      trough = cumulative
      troughDate = trade.tradeDate
    }
  })

  return {
    maxDrawdownMicros: safeBigIntToNumber(maxDrawdown, 'Maximum drawdown'),
    peakCumulativeMicros: safeBigIntToNumber(drawdownPeak, 'Drawdown peak'),
    troughCumulativeMicros: safeBigIntToNumber(trough, 'Drawdown trough'),
    peakDate: maxDrawdown > 0n ? findPeakDate(trades, values, drawdownPeak) : peakDate,
    troughDate,
  }
}

function findPeakDate(trades, values, targetPeak) {
  let cumulative = 0n
  let result = null
  trades.forEach((trade, index) => {
    cumulative += BigInt(values[index])
    if (cumulative === targetPeak) result = trade.tradeDate
  })
  return result
}

function calculateDailyOutcomes(trades, values) {
  const byDate = new Map()
  trades.forEach((trade, index) => {
    const current = byDate.get(trade.tradeDate) ?? 0n
    byDate.set(trade.tradeDate, current + BigInt(values[index]))
  })

  let winningDays = 0
  let losingDays = 0
  let breakEvenDays = 0
  for (const total of byDate.values()) {
    if (total > 0n) winningDays += 1
    else if (total < 0n) losingDays += 1
    else breakEvenDays += 1
  }

  return { winningDays, losingDays, breakEvenDays, tradingDays: byDate.size }
}

export function summarizeTrades(trades, basis) {
  const tradeCount = trades.length
  const grossAvailable = trades.filter((trade) => trade.grossPnlMicros !== null).length
  const netAvailable = trades.filter((trade) => trade.netPnlMicros !== null).length
  const rAvailable = trades.filter((trade) => trade.grossR !== null).length
  const netComplete = netAvailable === tradeCount
  const selectedAvailable = basis === 'net' ? netAvailable : tradeCount
  const selectedComplete = basis === 'gross' || netComplete

  const grossPnlMicros = sumMicros(
    trades.map((trade) => trade.grossPnlMicros ?? 0),
    'Gross P&L',
  )
  const netPnlMicros = netComplete
    ? sumMicros(
        trades.map((trade) => trade.netPnlMicros ?? 0),
        'Net P&L',
      )
    : null

  const rValues = trades.filter((trade) => trade.grossR !== null).map((trade) => trade.grossR)
  const averageR =
    rValues.length === 0
      ? null
      : decimalString(
          rValues.reduce((sum, value) => sum.plus(value), new Decimal(0)).div(rValues.length),
        )

  const summary = {
    basis,
    tradeCount,
    grossPnlMicros,
    netPnlMicros,
    totalPnlMicros: null,
    wins: null,
    losses: null,
    breakEvens: null,
    winRate: null,
    averageWinMicros: null,
    averageLossMicros: null,
    profitFactor: null,
    averageR,
    winningDays: null,
    losingDays: null,
    breakEvenDays: null,
    tradingDays: null,
    maxDrawdownMicros: null,
    peakCumulativeMicros: null,
    troughCumulativeMicros: null,
    peakDate: null,
    troughDate: null,
    streaks: null,
    coverage: {
      grossAvailable,
      grossComplete: grossAvailable === tradeCount,
      netAvailable,
      netComplete,
      rAvailable,
      rComplete: rAvailable === tradeCount,
      missingNetCount: tradeCount - netAvailable,
      missingRiskCount: tradeCount - rAvailable,
    },
  }

  if (!selectedComplete || selectedAvailable === 0) return summary

  const values = trades.map((trade) => selectedValue(trade, basis))
  const outcomes = values.map((value) => outcomeForPnl(value))
  const wins = outcomes.filter((outcome) => outcome === 'win').length
  const losses = outcomes.filter((outcome) => outcome === 'loss').length
  const breakEvens = outcomes.filter((outcome) => outcome === 'break_even').length
  const positive = values.filter((value) => value > 0)
  const negative = values.filter((value) => value < 0).map((value) => -value)

  summary.totalPnlMicros = sumMicros(values, 'Selected P&L')
  summary.wins = wins
  summary.losses = losses
  summary.breakEvens = breakEvens
  summary.winRate = ratio(wins, wins + losses)
  summary.averageWinMicros =
    positive.length === 0
      ? null
      : averageMicros(sumMicros(positive, 'Winning P&L'), positive.length, 'Average win')
  summary.averageLossMicros =
    negative.length === 0
      ? null
      : averageMicros(sumMicros(negative, 'Losing P&L'), negative.length, 'Average loss')
  summary.profitFactor = profitFactor(
    positive.length === 0 ? 0 : sumMicros(positive, 'Gross profit'),
    negative.length === 0 ? 0 : sumMicros(negative, 'Gross loss'),
  )

  const daily = calculateDailyOutcomes(trades, values)
  summary.winningDays = daily.winningDays
  summary.losingDays = daily.losingDays
  summary.breakEvenDays = daily.breakEvenDays
  summary.tradingDays = daily.tradingDays

  const drawdown = calculateDrawdown(trades, values)
  summary.maxDrawdownMicros = drawdown.maxDrawdownMicros
  summary.peakCumulativeMicros = drawdown.peakCumulativeMicros
  summary.troughCumulativeMicros = drawdown.troughCumulativeMicros
  summary.peakDate = drawdown.peakDate
  summary.troughDate = drawdown.troughDate
  summary.streaks = calculateStreaks(values)

  return summary
}

export async function getSummary(userId, query) {
  const trades = await findTrades(userId, query)
  return summarizeTrades(trades, query.basis)
}

function groupKeyForTrade(trade, dimension) {
  if (dimension === 'instrument') return trade.instrumentSnapshot.symbol
  if (dimension === 'account') return trade.accountSnapshot.name
  if (dimension === 'direction') return trade.direction
  if (dimension === 'session') return trade.sessionSnapshot?.name ?? 'No session'
  if (dimension === 'tag')
    return trade.tags.length > 0 ? trade.tags.map((tag) => tag.name) : ['Untagged']
  if (dimension === 'dayOfWeek') {
    const day = new Date(`${trade.tradeDate}T12:00:00Z`).getUTCDay()
    return DAY_NAMES[(day + 6) % 7]
  }
  return 'Unknown'
}

export async function getBreakdowns(userId, query) {
  const trades = await findTrades(userId, query)
  const groups = new Map()

  for (const trade of trades) {
    const keys = groupKeyForTrade(trade, query.dimension)
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(trade)
    }
  }

  return [...groups.entries()]
    .map(([label, groupTrades]) => ({
      label,
      summary: summarizeTrades(groupTrades, query.basis),
    }))
    .sort((left, right) => left.label.localeCompare(right.label))
}

async function findBalanceTrades(userId, accountId, to) {
  return Trade.find({
    userId,
    accountId,
    deletedAt: null,
    ...(to ? { tradeDate: { $lte: to } } : {}),
  })
    .sort({ tradeDate: 1, createdAt: 1, _id: 1 })
    .lean()
}

async function findBalanceAdjustments(userId, accountId, to) {
  return AccountAdjustment.find({
    userId,
    accountId,
    deletedAt: null,
    ...(to ? { date: { $lte: to } } : {}),
  })
    .sort({ date: 1, createdAt: 1, _id: 1 })
    .lean()
}

function eventOrder(left, right) {
  if (left.date !== right.date) return left.date.localeCompare(right.date)
  const leftCreated = left.createdAt?.getTime?.() ?? 0
  const rightCreated = right.createdAt?.getTime?.() ?? 0
  if (leftCreated !== rightCreated) return leftCreated - rightCreated
  if (left.kind !== right.kind) return left.kind === 'trade' ? -1 : 1
  return left.key.localeCompare(right.key)
}

function tradeEvent(trade, visible) {
  return {
    key: `trade:${trade._id}`,
    kind: 'trade',
    id: trade._id.toString(),
    date: trade.tradeDate,
    createdAt: trade.createdAt,
    trade,
    visible,
  }
}

function adjustmentEvent(adjustment, visible) {
  return {
    key: `adjustment:${adjustment._id}`,
    kind: 'adjustment',
    id: adjustment._id.toString(),
    date: adjustment.date,
    createdAt: adjustment.createdAt,
    adjustment,
    visible,
  }
}

export async function getEquityCurve(userId, query) {
  const curveTrades = await findTrades(userId, query)
  let account = null
  let balanceTrades = []
  let balanceAdjustments = []

  if (query.accountId) {
    account = await TradingAccount.findOne({ _id: query.accountId, userId }).lean()
    if (!account) throw new HttpError(404, 'NOT_FOUND', 'The requested account was not found.')

    balanceTrades = await findBalanceTrades(userId, query.accountId, query.to)
    balanceAdjustments = await findBalanceAdjustments(userId, query.accountId, query.to)
  }

  const visibleTradeIds = new Set(curveTrades.map((trade) => trade._id.toString()))
  const events = new Map()

  for (const trade of balanceTrades) {
    const event = tradeEvent(trade, visibleTradeIds.has(trade._id.toString()))
    events.set(event.key, event)
  }

  for (const trade of curveTrades) {
    const key = `trade:${trade._id}`
    if (!events.has(key)) events.set(key, tradeEvent(trade, true))
  }

  for (const adjustment of balanceAdjustments) {
    const visible = !query.from || adjustment.date >= query.from
    const event = adjustmentEvent(adjustment, visible)
    events.set(event.key, event)
  }

  const orderedEvents = [...events.values()].sort(eventOrder)

  let periodCumulative = 0n
  let periodComplete = true
  let balanceCumulative = 0n
  let balanceComplete = true
  let adjustmentTotal = 0n
  const points = []

  for (const event of orderedEvents) {
    if (event.kind === 'trade') {
      const { trade } = event

      if (event.visible) {
        if (trade.netPnlMicros === null) periodComplete = false
        else if (periodComplete) periodCumulative += BigInt(trade.netPnlMicros)
      }

      if (account) {
        if (trade.netPnlMicros === null) balanceComplete = false
        else if (balanceComplete) balanceCumulative += BigInt(trade.netPnlMicros)
      }
    } else {
      adjustmentTotal += BigInt(event.adjustment.signedAmountMicros)
    }

    if (!event.visible) continue

    const accountBalanceMicros =
      account && balanceComplete
        ? safeBigIntToNumber(
            BigInt(account.startingBalanceMicros) + adjustmentTotal + balanceCumulative,
            'Account balance',
          )
        : null

    points.push({
      id: event.id,
      kind: event.kind,
      date: event.date,
      cumulativeNetPnlMicros: periodComplete
        ? safeBigIntToNumber(periodCumulative, 'Cumulative net P&L')
        : null,
      accountBalanceMicros,
      tradeCount: event.kind === 'trade' ? 1 : 0,
      adjustmentCount: event.kind === 'adjustment' ? 1 : 0,
      netComplete: periodComplete,
      accountBalanceComplete: Boolean(account) && balanceComplete,
      ...(event.kind === 'trade'
        ? {
            tradeId: event.id,
            symbol: event.trade.instrumentSnapshot.symbol,
            direction: event.trade.direction,
            tradePnlMicros: event.trade.netPnlMicros,
          }
        : {
            adjustmentId: event.id,
            adjustmentType: event.adjustment.type,
            adjustmentSignedAmountMicros: event.adjustment.signedAmountMicros,
          }),
    })
  }

  return {
    points,
    cumulativeNetPnlMicros: points.length === 0 ? 0 : points.at(-1).cumulativeNetPnlMicros,
    accountBalanceMicros: account ? (points.at(-1)?.accountBalanceMicros ?? null) : null,
    accountBalanceAvailable: Boolean(account),
    startingBalanceMicros: account ? account.startingBalanceMicros : null,
    missingNetTradeCount: curveTrades.filter((trade) => trade.netPnlMicros === null).length,
    netComplete: periodComplete,
  }
}

function deltaMicros(current, baseline) {
  if (current === null || baseline === null) return null
  return safeBigIntToNumber(BigInt(current) - BigInt(baseline), 'P&L change')
}

function deltaDecimal(current, baseline) {
  if (current === null || baseline === null) return null
  return decimalString(new Decimal(current).minus(baseline))
}

export async function getComparison(userId, query) {
  const currentTrades = await findTrades(userId, query, {
    from: query.from,
    to: query.to,
  })
  const baselineTrades = await findTrades(userId, query, {
    from: query.compareFrom,
    to: query.compareTo,
  })

  const current = summarizeTrades(currentTrades, query.basis)
  const baseline = summarizeTrades(baselineTrades, query.basis)

  return {
    current,
    baseline,
    deltas: {
      tradeCount: current.tradeCount - baseline.tradeCount,
      totalPnlMicros: deltaMicros(current.totalPnlMicros, baseline.totalPnlMicros),
      winRate: deltaDecimal(current.winRate, baseline.winRate),
      averageR: deltaDecimal(current.averageR, baseline.averageR),
    },
  }
}
