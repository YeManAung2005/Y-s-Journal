import { z } from 'zod'
import { objectIdSchema, versionSchema } from './reference.js'

export const widgetIdSchema = z.enum([
  'trades_summary',
  'study_summary',
  'calendar_activity',
  'goals_progress',
])

const widgetSizeSchema = z.enum(['small', 'medium', 'large'])

export const widgetSchema = z
  .object({
    id: widgetIdSchema,
    visible: z.boolean().default(true),
    size: widgetSizeSchema.default('medium'),
    position: z.number().int().min(0).max(50),
    settings: z
      .object({
        basis: z.enum(['gross', 'net']).optional(),
        days: z.number().int().min(7).max(365).optional(),
      })
      .strict()
      .default({}),
  })
  .strict()

const layoutNameSchema = z.string().trim().min(1, 'Name is required.').max(60)

export const dashboardLayoutCreateSchema = z
  .object({
    name: layoutNameSchema,
    isDefault: z.boolean().default(false),
    widgets: z.array(widgetSchema).max(20).default([]),
  })
  .strict()

export const dashboardLayoutPatchSchema = z
  .object({
    name: layoutNameSchema.optional(),
    isDefault: z.boolean().optional(),
    widgets: z.array(widgetSchema).max(20).optional(),
    expectedVersion: versionSchema,
  })
  .strict()
  .refine((value) => Object.keys(value).length > 1, {
    message: 'Include at least one field to update.',
  })

export const dashboardQuerySchema = z
  .object({
    layoutId: objectIdSchema.optional(),
  })
  .strict()

export const dashboardExpectedVersionSchema = z.object({ expectedVersion: versionSchema }).strict()
