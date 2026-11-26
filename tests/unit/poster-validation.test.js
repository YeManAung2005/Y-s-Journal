import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  posterConfigCreateSchema,
  posterConfigPatchSchema,
  posterDataQuerySchema,
  posterExpectedVersionSchema,
} from '../../src/shared/validation/poster.js'

describe('poster validation', () => {
  it('normalizes poster defaults', () => {
    const parsed = posterConfigCreateSchema.parse({ name: 'Focus poster', type: 'trading' })

    expect(parsed).toMatchObject({
      name: 'Focus poster',
      type: 'trading',
      template: 'midnight',
      dimension: 'square',
      accentColor: '#8b5cf6',
      logoPosition: 'top-left',
      days: 30,
      basis: 'gross',
      headline: '',
      subtitle: '',
      footer: '',
      tradeId: null,
    })
  })

  it('requires an owned completed trade for a trade poster', () => {
    const tradeId = '64b7f9c2a1d3e4f5a6b7c8d9'

    expect(() => posterConfigCreateSchema.parse({ name: 'Trade ROI', type: 'trade' })).toThrow()
    expect(() =>
      posterConfigCreateSchema.parse({ name: 'Trade ROI', type: 'trade', tradeId: 'not-an-id' }),
    ).toThrow()
    expect(
      posterConfigCreateSchema.parse({ name: 'Trade ROI', type: 'trade', tradeId }),
    ).toMatchObject({ type: 'trade', tradeId })
  })

  it('rejects unsupported poster values', () => {
    expect(() => posterConfigCreateSchema.parse({ name: 'Bad type', type: 'journal' })).toThrow()
    expect(() =>
      posterConfigCreateSchema.parse({ name: 'Bad template', type: 'trading', template: 'neon' }),
    ).toThrow()
    expect(() =>
      posterConfigCreateSchema.parse({
        name: 'Bad dimension',
        type: 'trading',
        dimension: 'billboard',
      }),
    ).toThrow()
    expect(() =>
      posterConfigCreateSchema.parse({
        name: 'Bad color',
        type: 'trading',
        accentColor: 'purple',
      }),
    ).toThrow()
    expect(() =>
      posterConfigCreateSchema.parse({ name: 'Bad days', type: 'trading', days: 3 }),
    ).toThrow()
  })

  it('requires expectedVersion and at least one poster field for a patch', () => {
    expect(() => posterConfigPatchSchema.parse({ expectedVersion: 0 })).toThrow()
    expect(() => posterConfigPatchSchema.parse({ name: 'Renamed' })).toThrow()
    expect(() =>
      posterConfigPatchSchema.parse({ name: 'Renamed', expectedVersion: 0 }),
    ).not.toThrow()
    expect(posterExpectedVersionSchema.parse({ expectedVersion: 2 })).toEqual({
      expectedVersion: 2,
    })
  })

  it('coerces and validates poster data queries', () => {
    expect(posterDataQuerySchema.parse({ type: 'trading' })).toEqual({
      type: 'trading',
      days: 30,
      basis: 'gross',
    })
    expect(posterDataQuerySchema.parse({ type: 'learning', days: '90', basis: 'net' })).toEqual({
      type: 'learning',
      days: 90,
      basis: 'net',
    })
    expect(() => posterDataQuerySchema.parse({ type: 'trading', days: '2' })).toThrow()
    expect(() => posterDataQuerySchema.parse({ type: 'calendar' })).toThrow()

    const tradeId = '64b7f9c2a1d3e4f5a6b7c8d9'
    expect(posterDataQuerySchema.parse({ type: 'trade', tradeId })).toMatchObject({
      type: 'trade',
      tradeId,
    })
    expect(() => posterDataQuerySchema.parse({ type: 'trade' })).toThrow()
    expect(() => posterDataQuerySchema.parse({ type: 'trading', tradeId })).toThrow()
  })
})

describe('phase 8 privacy boundaries', () => {
  it('keeps journal models and content fields out of poster data', async () => {
    const source = await readFile(path.resolve('src/server/services/poster-service.js'), 'utf8')

    expect(source).not.toContain('journal-entry')
    expect(source).not.toContain('quick-note')
    for (const field of [
      'highlights',
      'challenges',
      'lessons',
      'gratitude',
      'mood',
      'reflection',
      'freeWriting',
      'tomorrowPriorities',
      'notes',
      'emotions',
      'ruleViolations',
      'review',
      'screenshots',
    ]) {
      expect(source).not.toContain(field)
    }
  })
})
