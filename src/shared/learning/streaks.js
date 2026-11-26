function addDays(dateString, amount) {
  const [year, month, day] = dateString.split('-').map(Number)
  const value = new Date(Date.UTC(year, month - 1, day))
  value.setUTCDate(value.getUTCDate() + amount)
  return value.toISOString().slice(0, 10)
}

function previousDate(dateString) {
  return addDays(dateString, -1)
}

/**
 * A study day counts toward a streak when its total duration reaches the
 * owner's daily target. A zero target means any positive study time counts.
 */
function qualifies(minutes, dailyTargetMinutes) {
  return minutes > 0 && minutes >= Math.max(1, dailyTargetMinutes)
}

function groupByDate(records) {
  const days = new Map()

  for (const record of records) {
    const current = days.get(record.date) ?? { date: record.date, minutes: 0, recordCount: 0 }
    current.minutes += Math.max(0, Number(record.durationMinutes) || 0)
    current.recordCount += 1
    days.set(record.date, current)
  }

  return [...days.values()].sort((left, right) => left.date.localeCompare(right.date))
}

export function summarizeLearning(
  records,
  { today, dailyTargetMinutes = 0, from = null, to = null } = {},
) {
  const target = Math.max(0, Number(dailyTargetMinutes) || 0)
  const allDays = groupByDate(records)
  const qualifyingDates = allDays
    .filter((day) => day.date <= today && qualifies(day.minutes, target))
    .map((day) => day.date)

  let longestStreak = 0
  let runningStreak = 0
  let previous = null
  for (const date of qualifyingDates) {
    runningStreak = previous && addDays(previous, 1) === date ? runningStreak + 1 : 1
    longestStreak = Math.max(longestStreak, runningStreak)
    previous = date
  }

  const qualifyingSet = new Set(qualifyingDates)
  let cursor = qualifyingSet.has(today) ? today : previousDate(today)
  let currentStreak = 0
  while (qualifyingSet.has(cursor)) {
    currentStreak += 1
    cursor = previousDate(cursor)
  }

  const filteredDays = allDays.filter(
    (day) => (!from || day.date >= from) && (!to || day.date <= to),
  )
  const withQualification = filteredDays.map((day) => ({
    ...day,
    targetMet: qualifies(day.minutes, target),
  }))
  const todayEntry = allDays.find((day) => day.date === today)
  const todayMinutes = todayEntry?.minutes ?? 0
  const lastStudyDate = allDays.filter((day) => day.date <= today).at(-1)?.date ?? null

  return {
    today,
    dailyTargetMinutes: target,
    currentStreak,
    longestStreak,
    totalMinutes: withQualification.reduce((sum, day) => sum + day.minutes, 0),
    recordCount: withQualification.reduce((sum, day) => sum + day.recordCount, 0),
    activeDays: withQualification.length,
    qualifyingDays: qualifyingDates.length,
    lastStudyDate,
    todayMinutes,
    todayRecordCount: todayEntry?.recordCount ?? 0,
    targetMetToday: qualifies(todayMinutes, target),
    days: withQualification,
  }
}

export { addDays }
