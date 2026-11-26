import { describe, expect, it } from 'vitest'
import { summarizeTrades } from '../../src/server/services/analytics-service.js'

function trade({ date, gross, net = gross, r = '0' }) {
  return {
    tradeDate: date,
    grossPnlMicros: gross,
    netPnlMicros: net,
    grossR: r,
  }
}

describe('analytics summary calculations', () => {
  it('returns Infinity for profit with no losses', () => {
    const summary = summarizeTrades(
      [trade({ date: '2026-11-01', gross: 1_000_000, r: '1' })],
      'net',
    )
    expect(summary.profitFactor).toBe('Infinity')
    expect(summary.averageWinMicros).toBe(1_000_000)
    expect(summary.averageLossMicros).toBeNull()
    expect(summary.winRate).toBe('1')
  })

  it('returns zero for losses with no profit', () => {
    const summary = summarizeTrades(
      [trade({ date: '2026-11-01', gross: -500_000, r: '-1' })],
      'net',
    )
    expect(summary.profitFactor).toBe('0')
    expect(summary.averageWinMicros).toBeNull()
    expect(summary.averageLossMicros).toBe(500_000)
    expect(summary.winRate).toBe('0')
  })

  it('returns no profit factor when every trade breaks even', () => {
    const summary = summarizeTrades(
      [
        trade({ date: '2026-11-01', gross: 0, r: '0' }),
        trade({ date: '2026-11-02', gross: 0, r: '0' }),
      ],
      'net',
    )
    expect(summary.profitFactor).toBeNull()
    expect(summary.winRate).toBeNull()
    expect(summary.breakEvens).toBe(2)
  })

  it('keeps net values unavailable and excludes missing risk from average R', () => {
    const summary = summarizeTrades(
      [
        trade({ date: '2026-11-01', gross: 2_000_000, net: 1_900_000, r: '2' }),
        trade({ date: '2026-11-02', gross: -1_000_000, net: null, r: null }),
      ],
      'net',
    )

    expect(summary.grossPnlMicros).toBe(1_000_000)
    expect(summary.netPnlMicros).toBeNull()
    expect(summary.totalPnlMicros).toBeNull()
    expect(summary.wins).toBeNull()
    expect(summary.coverage).toMatchObject({
      netAvailable: 1,
      netComplete: false,
      rAvailable: 1,
      missingRiskCount: 1,
    })
    expect(summary.averageR).toBe('2')
  })

  it('calculates drawdown and streaks from chronological trades', () => {
    const summary = summarizeTrades(
      [
        trade({ date: '2026-11-01', gross: 1_000_000, r: '1' }),
        trade({ date: '2026-11-02', gross: 2_000_000, r: '2' }),
        trade({ date: '2026-11-03', gross: -1_500_000, r: '-1.5' }),
        trade({ date: '2026-11-04', gross: -500_000, r: '-0.5' }),
        trade({ date: '2026-11-05', gross: 250_000, r: '0.25' }),
      ],
      'gross',
    )

    expect(summary.totalPnlMicros).toBe(1_250_000)
    expect(summary.maxDrawdownMicros).toBe(2_000_000)
    expect(summary.peakCumulativeMicros).toBe(3_000_000)
    expect(summary.troughCumulativeMicros).toBe(1_000_000)
    expect(summary.streaks).toMatchObject({
      currentWinningStreak: 1,
      currentLosingStreak: 0,
      longestWinningStreak: 2,
      longestLosingStreak: 2,
    })
  })
})
