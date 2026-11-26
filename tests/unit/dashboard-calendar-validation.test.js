import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { calendarQuerySchema, monthSchema } from '../../src/shared/validation/calendar.js'
import {
  dashboardExpectedVersionSchema,
  dashboardLayoutCreateSchema,
  dashboardLayoutPatchSchema,
  dashboardQuerySchema,
} from '../../src/shared/validation/dashboard.js'

describe('dashboard and calendar validation', () => {
  it('accepts supported widgets and normalizes layout defaults', () => {
    const parsed = dashboardLayoutCreateSchema.parse({ name: 'Focus' })

    expect(parsed).toMatchObject({ name: 'Focus', isDefault: false, widgets: [] })
  })

  it('rejects unknown widgets and invalid widget settings', () => {
    expect(() =>
      dashboardLayoutCreateSchema.parse({
        name: 'Bad widget',
        widgets: [{ id: 'journal_widget', position: 0 }],
      }),
    ).toThrow()
    expect(() =>
      dashboardLayoutCreateSchema.parse({
        name: 'Bad basis',
        widgets: [{ id: 'trades_summary', position: 0, settings: { basis: 'all' } }],
      }),
    ).toThrow()
    expect(() =>
      dashboardLayoutCreateSchema.parse({
        name: 'Bad days',
        widgets: [{ id: 'study_summary', position: 0, settings: { days: 3 } }],
      }),
    ).toThrow()
  })

  it('requires expectedVersion and at least one patch field', () => {
    expect(() => dashboardLayoutPatchSchema.parse({ expectedVersion: 0 })).toThrow()
    expect(() => dashboardLayoutPatchSchema.parse({ name: 'Renamed' })).toThrow()
    expect(() =>
      dashboardLayoutPatchSchema.parse({ name: 'Renamed', expectedVersion: 0 }),
    ).not.toThrow()
    expect(dashboardExpectedVersionSchema.parse({ expectedVersion: 2 })).toEqual({
      expectedVersion: 2,
    })
  })

  it('validates dashboard and calendar query strings', () => {
    expect(() => monthSchema.parse('2026-13')).toThrow()
    expect(() => calendarQuerySchema.parse({ month: '2026-11-01' })).toThrow()
    expect(calendarQuerySchema.parse({ month: '2026-11' })).toEqual({ month: '2026-11' })
    expect(() =>
      dashboardQuerySchema.parse({ layoutId: '000000000000000000000000', extra: 'x' }),
    ).toThrow()
    expect(dashboardQuerySchema.parse({ layoutId: '000000000000000000000000' })).toEqual({
      layoutId: '000000000000000000000000',
    })
  })
})

describe('phase 7 privacy boundaries', () => {
  it('keeps journal content fields out of calendar aggregation', async () => {
    const source = await readFile(path.resolve('src/server/services/calendar-service.js'), 'utf8')

    expect(source).toMatch(/from '\.\.\/models\/journal-entry\.js'/)
    for (const field of [
      'highlights',
      'challenges',
      'lessons',
      'gratitude',
      'mood',
      'reflection',
      'freeWriting',
      'tomorrowPriorities',
    ]) {
      expect(source).not.toContain(field)
    }
    expect(source).toContain('hasJournalEntry')
  })
})
