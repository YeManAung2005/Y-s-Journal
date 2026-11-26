import { LearningRecord } from '../models/learning-record.js'
import { JournalEntry } from '../models/journal-entry.js'
import { Settings } from '../models/settings.js'
import { Trade } from '../models/trade.js'
import { assertSafeInteger } from '../../shared/finance/units.js'
import { todayInTimeZone } from '../lib/timezone.js'

function monthBounds(month) {
  const [year, monthNumber] = month.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  const suffix = String(lastDay).padStart(2, '0')
  return { from: `${month}-01`, to: `${month}-${suffix}`, lastDay }
}

function sumMicros(values, label) {
  const total = values.reduce((sum, value) => sum + BigInt(value), 0n)
  return assertSafeInteger(Number(total), label)
}

function dayTemplate(date) {
  return {
    date,
    tradeCount: 0,
    grossPnlMicros: 0,
    netPnlMicros: 0,
    netAvailableCount: 0,
    studyMinutes: 0,
    studyRecordCount: 0,
  }
}

function dateRange(from, to) {
  return { $gte: from, $lte: to }
}

function enumerateDates(from, to) {
  const dates = []
  const cursor = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return dates
}

export async function getActivityRange(userId, from, to) {
  const dateFilter = dateRange(from, to)
  const [trades, studyRecords] = await Promise.all([
    Trade.find({ userId, deletedAt: null, tradeDate: dateFilter }).select({ tradeDate: 1 }).lean(),
    LearningRecord.find({ userId, deletedAt: null, date: dateFilter })
      .select({ date: 1, durationMinutes: 1 })
      .lean(),
  ])

  const days = new Map(
    enumerateDates(from, to).map((date) => [
      date,
      { date, tradeCount: 0, studyMinutes: 0, studyRecordCount: 0 },
    ]),
  )

  for (const trade of trades) {
    const day = days.get(trade.tradeDate)
    if (day) day.tradeCount += 1
  }

  for (const record of studyRecords) {
    const day = days.get(record.date)
    if (!day) continue
    day.studyMinutes += record.durationMinutes ?? 0
    day.studyRecordCount += 1
  }

  return [...days.values()]
}

export async function getCalendarMonth(userId, month) {
  const { from, to, lastDay } = monthBounds(month)
  const dateFilter = dateRange(from, to)

  const [trades, studyRecords, settings] = await Promise.all([
    Trade.find({ userId, deletedAt: null, tradeDate: dateFilter })
      .select({ tradeDate: 1, grossPnlMicros: 1, netPnlMicros: 1 })
      .lean(),
    LearningRecord.find({ userId, deletedAt: null, date: dateFilter })
      .select({ date: 1, durationMinutes: 1 })
      .lean(),
    Settings.findOne({ userId }).select({ calendarJournalIndicator: 1 }).lean(),
  ])

  const days = new Map()
  for (let day = 1; day <= lastDay; day += 1) {
    const date = `${month}-${String(day).padStart(2, '0')}`
    days.set(date, dayTemplate(date))
  }

  for (const trade of trades) {
    const day = days.get(trade.tradeDate)
    if (!day) continue
    day.tradeCount += 1
    day.grossPnlMicros = sumMicros(
      [day.grossPnlMicros, trade.grossPnlMicros ?? 0],
      'Calendar gross P&L',
    )
    if (trade.netPnlMicros !== null && trade.netPnlMicros !== undefined) {
      day.netPnlMicros = sumMicros([day.netPnlMicros, trade.netPnlMicros], 'Calendar net P&L')
      day.netAvailableCount += 1
    }
  }

  for (const record of studyRecords) {
    const day = days.get(record.date)
    if (!day) continue
    day.studyMinutes += record.durationMinutes ?? 0
    day.studyRecordCount += 1
  }

  const journalIndicatorEnabled = Boolean(settings?.calendarJournalIndicator)
  let journalDates = new Set()
  if (journalIndicatorEnabled) {
    const entries = await JournalEntry.find({ userId, deletedAt: null, date: dateFilter })
      .select({ date: 1, _id: 0 })
      .lean()
    journalDates = new Set(entries.map((entry) => entry.date))
  }

  const serializedDays = [...days.values()].map((day) => {
    const result = {
      date: day.date,
      tradeCount: day.tradeCount,
      grossPnlMicros: day.grossPnlMicros,
      netPnlMicros:
        day.tradeCount > 0 && day.netAvailableCount === day.tradeCount ? day.netPnlMicros : null,
      studyMinutes: day.studyMinutes,
      studyRecordCount: day.studyRecordCount,
    }
    if (journalIndicatorEnabled) result.hasJournalEntry = journalDates.has(day.date)
    return result
  })

  return {
    month,
    from,
    to,
    journalIndicatorEnabled,
    summary: serializedDays.reduce(
      (summary, day) => ({
        activeDays: summary.activeDays + (day.tradeCount > 0 || day.studyRecordCount > 0 ? 1 : 0),
        tradeDays: summary.tradeDays + (day.tradeCount > 0 ? 1 : 0),
        studyDays: summary.studyDays + (day.studyRecordCount > 0 ? 1 : 0),
        tradeCount: summary.tradeCount + day.tradeCount,
        studyMinutes: summary.studyMinutes + day.studyMinutes,
        studyRecordCount: summary.studyRecordCount + day.studyRecordCount,
      }),
      {
        activeDays: 0,
        tradeDays: 0,
        studyDays: 0,
        tradeCount: 0,
        studyMinutes: 0,
        studyRecordCount: 0,
      },
    ),
    days: serializedDays,
  }
}

export function currentMonthInTimeZone(timeZone = 'Asia/Yangon', now = new Date()) {
  return todayInTimeZone(timeZone, now).slice(0, 7)
}
