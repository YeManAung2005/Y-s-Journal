import { z } from 'zod'
import { versionSchema } from './reference.js'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date in YYYY-MM-DD format.')

const highlightsSchema = z.string().trim().max(5000)
const challengesSchema = z.string().trim().max(5000)
const lessonsSchema = z.string().trim().max(5000)
const reflectionSchema = z.string().trim().max(10000)
const freeWritingSchema = z.string().trim().max(20000)
const gratitudeSchema = z.array(z.string().trim().max(500)).max(3)
const prioritiesSchema = z.array(z.string().trim().max(300)).max(5)
const moodSchema = z.number().int().min(1).max(5).nullable()

export const journalEntryCreateSchema = z
  .object({
    date: isoDate,
    highlights: highlightsSchema.default(''),
    challenges: challengesSchema.default(''),
    lessons: lessonsSchema.default(''),
    gratitude: gratitudeSchema.default([]),
    mood: moodSchema.default(null),
    reflection: reflectionSchema.default(''),
    freeWriting: freeWritingSchema.default(''),
    tomorrowPriorities: prioritiesSchema.default([]),
  })
  .strict()

export const journalEntryPatchSchema = z
  .object({
    date: isoDate.optional(),
    highlights: highlightsSchema.optional(),
    challenges: challengesSchema.optional(),
    lessons: lessonsSchema.optional(),
    gratitude: gratitudeSchema.optional(),
    mood: moodSchema.optional(),
    reflection: reflectionSchema.optional(),
    freeWriting: freeWritingSchema.optional(),
    tomorrowPriorities: prioritiesSchema.optional(),
    expectedVersion: versionSchema,
  })
  .strict()
  .refine((value) => Object.keys(value).length > 1, {
    message: 'Include at least one field to update.',
  })

export const journalEntryQuerySchema = z
  .object({
    includeDeleted: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    date: isoDate.optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    q: z.string().trim().min(1).max(200).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  })
  .strict()

export const journalSearchQuerySchema = z
  .object({
    q: z.string().trim().min(1, 'Enter something to search for.').max(200),
    scope: z.enum(['all', 'entries', 'notes']).default('all'),
    from: isoDate.optional(),
    to: isoDate.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict()

const noteTextSchema = z.string().trim().min(1, 'Write something first.').max(5000)

export const quickNoteCreateSchema = z
  .object({
    date: isoDate,
    text: noteTextSchema,
  })
  .strict()

export const quickNotePatchSchema = z
  .object({
    date: isoDate.optional(),
    text: noteTextSchema.optional(),
    expectedVersion: versionSchema,
  })
  .strict()
  .refine((value) => Object.keys(value).length > 1, {
    message: 'Include at least one field to update.',
  })

export const quickNoteQuerySchema = z
  .object({
    includeDeleted: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    date: isoDate.optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    q: z.string().trim().min(1).max(200).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  })
  .strict()

export const journalExpectedVersionSchema = z.object({ expectedVersion: versionSchema }).strict()

export { isoDate }
