import { z } from 'zod'
import { objectIdSchema } from './reference.js'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date in YYYY-MM-DD format.')

export const analyticsBasisSchema = z.enum(['gross', 'net'])

const dimensionSchema = z.enum([
  'instrument',
  'session',
  'direction',
  'tag',
  'account',
  'dayOfWeek',
])

const analyticsQueryObject = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  accountId: objectIdSchema.optional(),
  instrumentId: objectIdSchema.optional(),
  sessionId: objectIdSchema.optional(),
  tagId: objectIdSchema.optional(),
  direction: z.enum(['long', 'short']).optional(),
  outcome: z.enum(['win', 'loss', 'break_even']).optional(),
  basis: analyticsBasisSchema.default('net'),
  dimension: dimensionSchema.optional(),
  compareFrom: isoDate.optional(),
  compareTo: isoDate.optional(),
})

function withDateChecks(schema) {
  return schema
    .refine((value) => !value.from || !value.to || value.from <= value.to, {
      path: ['from'],
      message: 'The start date must be on or before the end date.',
    })
    .refine(
      (value) => !value.compareFrom || !value.compareTo || value.compareFrom <= value.compareTo,
      {
        path: ['compareFrom'],
        message: 'The comparison start date must be on or before its end date.',
      },
    )
}

export const analyticsQuerySchema = withDateChecks(analyticsQueryObject.strict())

export const breakdownQuerySchema = withDateChecks(
  analyticsQueryObject.extend({ dimension: dimensionSchema }).strict(),
)

export const comparisonQuerySchema = withDateChecks(analyticsQueryObject.strict()).refine(
  (value) => Boolean(value.from && value.to && value.compareFrom && value.compareTo),
  {
    path: ['compareFrom'],
    message: 'Supply current and comparison date ranges.',
  },
)
