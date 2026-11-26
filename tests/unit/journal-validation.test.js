import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  journalEntryCreateSchema,
  journalEntryPatchSchema,
  journalSearchQuerySchema,
  quickNoteCreateSchema,
} from '../../src/shared/validation/journal.js'

describe('journal validation', () => {
  it('normalizes entry defaults', () => {
    const parsed = journalEntryCreateSchema.parse({ date: '2026-11-25' })

    expect(parsed).toMatchObject({
      date: '2026-11-25',
      highlights: '',
      challenges: '',
      lessons: '',
      gratitude: [],
      mood: null,
      reflection: '',
      freeWriting: '',
      tomorrowPriorities: [],
    })
  })

  it('rejects invalid moods and oversized lists', () => {
    expect(() => journalEntryCreateSchema.parse({ date: '2026-11-25', mood: 0 })).toThrow()
    expect(() => journalEntryCreateSchema.parse({ date: '2026-11-25', mood: 6 })).toThrow()
    expect(() =>
      journalEntryCreateSchema.parse({
        date: '2026-11-25',
        gratitude: ['a', 'b', 'c', 'd'],
      }),
    ).toThrow()
    expect(() =>
      journalEntryCreateSchema.parse({
        date: '2026-11-25',
        tomorrowPriorities: ['1', '2', '3', '4', '5', '6'],
      }),
    ).toThrow()
  })

  it('requires at least one changed field on updates', () => {
    expect(() => journalEntryPatchSchema.parse({ expectedVersion: 0 })).toThrow()
    expect(() =>
      journalEntryPatchSchema.parse({ expectedVersion: 0, highlights: 'A good day' }),
    ).not.toThrow()
  })

  it('validates quick notes and search queries', () => {
    expect(() => quickNoteCreateSchema.parse({ date: '2026-11-25', text: '  ' })).toThrow()
    expect(() =>
      quickNoteCreateSchema.parse({ date: '2026-11-25', text: 'Remember the idea' }),
    ).not.toThrow()
    expect(() => journalSearchQuerySchema.parse({ q: '' })).toThrow()
    expect(journalSearchQuerySchema.parse({ q: 'idea' }).scope).toBe('all')
  })
})

describe('module privacy boundaries', () => {
  const serverFiles = [
    'src/server/services/analytics-service.js',
    'src/server/services/trade-service.js',
    'src/server/services/learning-service.js',
    'src/server/services/file-service.js',
    'src/server/services/dashboard-service.js',
  ]

  it('keeps journal models out of trading, analytics, and learning services', async () => {
    for (const file of serverFiles) {
      const source = await readFile(path.resolve(file), 'utf8')
      expect(source).not.toMatch(/journal-entry|quick-note|JournalEntry|QuickNote/)
    }
  })

  it('keeps journal services free of trading and learning models', async () => {
    const source = await readFile(path.resolve('src/server/services/journal-service.js'), 'utf8')
    expect(source).not.toMatch(/models\/(trade|learning-record|learning-goal|learning-category)/)
    expect(source).not.toMatch(/analytics-service|learning-service|trade-service/)
  })
})
