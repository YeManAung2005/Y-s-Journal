import { describe, expect, it } from 'vitest'
import { summarizeLearning } from '../../src/shared/learning/streaks.js'
import { dateInTimeZone, todayInTimeZone } from '../../src/server/lib/timezone.js'

function record(date, durationMinutes) {
  return { date, durationMinutes }
}

describe('learning streak calculations', () => {
  it('counts consecutive days that meet the daily target', () => {
    const summary = summarizeLearning(
      [
        record('2026-11-20', 60),
        record('2026-11-21', 90),
        record('2026-11-22', 30),
        record('2026-11-23', 120),
        record('2026-11-24', 60),
      ],
      { today: '2026-11-24', dailyTargetMinutes: 60 },
    )

    expect(summary.currentStreak).toBe(2)
    expect(summary.longestStreak).toBe(2)
    expect(summary.todayMinutes).toBe(60)
    expect(summary.targetMetToday).toBe(true)
    expect(summary.activeDays).toBe(5)
    expect(summary.qualifyingDays).toBe(4)
  })

  it("keeps yesterday's streak until today is missed", () => {
    const summary = summarizeLearning([record('2026-11-22', 60), record('2026-11-23', 60)], {
      today: '2026-11-24',
      dailyTargetMinutes: 60,
    })

    expect(summary.currentStreak).toBe(2)
    expect(summary.todayMinutes).toBe(0)
    expect(summary.targetMetToday).toBe(false)
  })

  it('sums multiple records on the same date and handles a zero target', () => {
    const summary = summarizeLearning(
      [record('2026-11-24', 20), record('2026-11-24', 10), record('2026-11-23', 1)],
      { today: '2026-11-24', dailyTargetMinutes: 0 },
    )

    expect(summary.days.at(-1)).toMatchObject({
      date: '2026-11-24',
      minutes: 30,
      recordCount: 2,
      targetMet: true,
    })
    expect(summary.currentStreak).toBe(2)
    expect(summary.longestStreak).toBe(2)
  })

  it('filters daily totals without changing all-time streaks', () => {
    const summary = summarizeLearning(
      [record('2026-11-01', 60), record('2026-11-02', 60), record('2026-11-03', 60)],
      {
        today: '2026-11-03',
        dailyTargetMinutes: 60,
        from: '2026-11-03',
        to: '2026-11-03',
      },
    )

    expect(summary.currentStreak).toBe(3)
    expect(summary.longestStreak).toBe(3)
    expect(summary.totalMinutes).toBe(60)
    expect(summary.activeDays).toBe(1)
    expect(summary.days).toHaveLength(1)
  })
})

describe('time-zone date helpers', () => {
  it('resolves the calendar date in the requested IANA time zone', () => {
    const instant = new Date('2026-11-24T18:30:00.000Z')
    expect(dateInTimeZone(instant, 'Asia/Yangon')).toBe('2026-11-25')
    expect(dateInTimeZone(instant, 'America/New_York')).toBe('2026-11-24')
    expect(todayInTimeZone('Asia/Yangon', instant)).toBe('2026-11-25')
  })
})
