import { z } from 'zod'
import { objectIdSchema, versionSchema } from './reference.js'

export const posterTypeSchema = z.enum(['trading', 'learning', 'trade'])
export const posterTemplateSchema = z.enum(['midnight', 'paper', 'ember'])
export const posterDimensionSchema = z.enum(['square', 'portrait', 'story'])
export const posterBasisSchema = z.enum(['gross', 'net'])
export const posterLogoPositionSchema = z.enum([
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'none',
])

const posterNameSchema = z.string().trim().min(1, 'Name is required.').max(80)
const posterColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex color such as #8b5cf6.')
const headlineSchema = z.string().trim().max(80)
const subtitleSchema = z.string().trim().max(140)
const footerSchema = z.string().trim().max(100)

const posterConfigFields = {
  name: posterNameSchema,
  type: posterTypeSchema,
  template: posterTemplateSchema.default('midnight'),
  dimension: posterDimensionSchema.default('square'),
  accentColor: posterColorSchema.default('#8b5cf6'),
  headline: headlineSchema.default(''),
  subtitle: subtitleSchema.default(''),
  footer: footerSchema.default(''),
  logoPosition: posterLogoPositionSchema.default('top-left'),
  days: z.number().int().min(7).max(365).default(30),
  basis: posterBasisSchema.default('gross'),
  tradeId: objectIdSchema.nullable().default(null),
}

export const posterConfigCreateSchema = z
  .object(posterConfigFields)
  .strict()
  .superRefine((value, context) => {
    if (value.type === 'trade' && !value.tradeId) {
      context.addIssue({
        code: 'custom',
        path: ['tradeId'],
        message: 'Choose a completed trade for a trade poster.',
      })
    }
  })

export const posterConfigPatchSchema = z
  .object({
    name: posterNameSchema.optional(),
    type: posterTypeSchema.optional(),
    template: posterTemplateSchema.optional(),
    dimension: posterDimensionSchema.optional(),
    accentColor: posterColorSchema.optional(),
    headline: headlineSchema.optional(),
    subtitle: subtitleSchema.optional(),
    footer: footerSchema.optional(),
    logoPosition: posterLogoPositionSchema.optional(),
    days: z.number().int().min(7).max(365).optional(),
    basis: posterBasisSchema.optional(),
    tradeId: objectIdSchema.nullable().optional(),
    expectedVersion: versionSchema,
  })
  .strict()
  .refine((value) => Object.keys(value).length > 1, {
    message: 'Include at least one poster field to update.',
  })

export const posterExpectedVersionSchema = z.object({ expectedVersion: versionSchema }).strict()

export const posterDataQuerySchema = z
  .object({
    type: posterTypeSchema,
    days: z.coerce.number().int().min(7).max(365).default(30),
    basis: posterBasisSchema.default('gross'),
    tradeId: objectIdSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.type === 'trade' && !value.tradeId) {
      context.addIssue({
        code: 'custom',
        path: ['tradeId'],
        message: 'Choose a completed trade for a trade poster.',
      })
    }
    if (value.type !== 'trade' && value.tradeId) {
      context.addIssue({
        code: 'custom',
        path: ['tradeId'],
        message: 'Trade posters require type=trade.',
      })
    }
  })
