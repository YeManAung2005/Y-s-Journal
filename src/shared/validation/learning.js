import { z } from 'zod'
import { objectIdSchema, versionSchema } from './reference.js'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date in YYYY-MM-DD format.')
const colorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex color such as #7c3aed.')
const nameSchema = z.string().trim().min(1, 'Name is required.').max(80)
const titleSchema = z.string().trim().min(1, 'Title is required.').max(160)

function httpUrl(value) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const resourceLinkSchema = z
  .object({
    label: z.string().trim().max(120).default(''),
    url: z
      .string()
      .trim()
      .min(1, 'A resource URL is required.')
      .max(2048)
      .refine(httpUrl, 'Use a complete http:// or https:// URL.'),
  })
  .strict()

export const learningCategoryCreateSchema = z
  .object({
    name: nameSchema,
    color: colorSchema.default('#8b5cf6'),
  })
  .strict()

export const learningCategoryPatchSchema = z
  .object({
    name: nameSchema.optional(),
    color: colorSchema.optional(),
    expectedVersion: versionSchema,
  })
  .strict()
  .refine((value) => Object.keys(value).length > 1, {
    message: 'Include at least one field to update.',
  })

const topicSchema = z.string().trim().min(1, 'Topic is required.').max(160)
const keyTakeawaysSchema = z.string().trim().max(10000)
const durationMinutesSchema = z.number().int().min(0).max(1440)
const notesSchema = z.string().trim().max(20000)
const resourcesSchema = z.array(resourceLinkSchema).max(20)

export const learningRecordCreateSchema = z
  .object({
    date: isoDate,
    categoryId: objectIdSchema,
    goalId: objectIdSchema.nullable().optional(),
    topic: topicSchema,
    keyTakeaways: keyTakeawaysSchema.default(''),
    durationMinutes: durationMinutesSchema.default(0),
    notes: notesSchema.default(''),
    resources: resourcesSchema.default([]),
  })
  .strict()

export const learningRecordPatchSchema = z
  .object({
    date: isoDate.optional(),
    categoryId: objectIdSchema.optional(),
    goalId: objectIdSchema.nullable().optional(),
    topic: topicSchema.optional(),
    keyTakeaways: keyTakeawaysSchema.optional(),
    durationMinutes: durationMinutesSchema.optional(),
    notes: notesSchema.optional(),
    resources: resourcesSchema.optional(),
    expectedVersion: versionSchema,
  })
  .strict()
  .refine((value) => Object.keys(value).length > 1, {
    message: 'Include at least one field to update.',
  })

export const learningRecordQuerySchema = z
  .object({
    includeDeleted: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    from: isoDate.optional(),
    to: isoDate.optional(),
    categoryId: objectIdSchema.optional(),
    goalId: objectIdSchema.optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  })
  .strict()

export const learningSummaryQuerySchema = z
  .object({
    from: isoDate.optional(),
    to: isoDate.optional(),
  })
  .strict()

const descriptionSchema = z.string().trim().max(5000)
const goalStatusSchema = z.enum(['active', 'completed'])

export const learningGoalCreateSchema = z
  .object({
    title: titleSchema,
    description: descriptionSchema.default(''),
    categoryId: objectIdSchema.nullable().optional(),
    targetDate: isoDate.nullable().optional(),
    status: goalStatusSchema.default('active'),
  })
  .strict()

export const learningGoalPatchSchema = z
  .object({
    title: titleSchema.optional(),
    description: descriptionSchema.optional(),
    categoryId: objectIdSchema.nullable().optional(),
    targetDate: isoDate.nullable().optional(),
    status: goalStatusSchema.optional(),
    expectedVersion: versionSchema,
  })
  .strict()
  .refine((value) => Object.keys(value).length > 1, {
    message: 'Include at least one field to update.',
  })

export const learningGoalQuerySchema = z
  .object({
    includeDeleted: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    categoryId: objectIdSchema.optional(),
    status: z.enum(['active', 'completed']).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  })
  .strict()

const milestoneFields = z
  .object({
    title: z.string().trim().min(1, 'Milestone title is required.').max(200),
    dueDate: isoDate.nullable().optional(),
  })
  .strict()

export const milestoneCreateSchema = milestoneFields.extend({
  expectedVersion: versionSchema,
})

export const milestonePatchSchema = milestoneFields
  .partial()
  .extend({ completed: z.boolean().optional(), expectedVersion: versionSchema })
  .strict()
  .refine(
    (value) =>
      value.title !== undefined || value.dueDate !== undefined || value.completed !== undefined,
    { message: 'Include at least one milestone field to update.' },
  )

const taskFields = z
  .object({
    title: z.string().trim().min(1, 'Task title is required.').max(200),
  })
  .strict()

export const taskCreateSchema = taskFields.extend({
  expectedVersion: versionSchema,
})

export const taskPatchSchema = taskFields
  .partial()
  .extend({ completed: z.boolean().optional(), expectedVersion: versionSchema })
  .strict()
  .refine((value) => value.title !== undefined || value.completed !== undefined, {
    message: 'Include at least one task field to update.',
  })

export const expectedVersionSchema = z.object({ expectedVersion: versionSchema }).strict()
