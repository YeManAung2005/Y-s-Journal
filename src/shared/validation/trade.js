import { z } from 'zod'
import { dollarsToMicros, priceToTicks, quantityToHundredths } from '../finance/units.js'
import { positiveMoney, priceString, quantityString } from './finance.js'
import { objectIdSchema } from './reference.js'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date in YYYY-MM-DD format.')

const shortText = z.string().trim().min(1).max(80)
const longText = z.string().trim().max(5000)

const reviewSchema = z
  .object({
    followedPlan: z.enum(['yes', 'no', 'partial']).nullable().default(null),
    whatWentWell: longText.default(''),
    whatToImprove: longText.default(''),
    confidence: z.number().int().min(1).max(5).nullable().default(null),
    reviewedAt: isoDate.nullable().default(null),
  })
  .prefault({})

const exitSchema = z.object({
  price: priceString,
  quantity: quantityString,
})

const checklistAnswerSchema = z.object({
  itemId: objectIdSchema,
  checked: z.boolean(),
})

export const tradeFields = z.object({
  accountId: objectIdSchema,
  instrumentId: objectIdSchema,
  tradeDate: isoDate,
  direction: z.enum(['long', 'short']),
  entryPrice: priceString,
  quantity: quantityString,
  exits: z.array(exitSchema).min(1).max(50),
  fees: positiveMoney.nullable().optional(),
  initialStopPrice: priceString.nullable().optional(),
  manualRisk: positiveMoney.nullable().optional(),
  sessionId: objectIdSchema.nullable().optional(),
  tagIds: z.array(objectIdSchema).max(30).default([]),
  checklist: z.array(checklistAnswerSchema).max(100).default([]),
  emotions: z.array(shortText).max(15).default([]),
  ruleViolations: z.array(shortText).max(15).default([]),
  notes: longText.default(''),
  lessons: longText.default(''),
  review: reviewSchema,
})

export const tradeCreateSchema = tradeFields
  .strict()
  .refine((value) => new Set(value.tagIds).size === value.tagIds.length, {
    path: ['tagIds'],
    message: 'A tag cannot be added twice.',
  })
  .refine(
    (value) => new Set(value.checklist.map((item) => item.itemId)).size === value.checklist.length,
    { path: ['checklist'], message: 'A checklist item cannot be added twice.' },
  )

export const tradePatchSchema = tradeFields
  .partial()
  .extend({ expectedVersion: z.number().int().min(0) })
  .strict()
  .refine((value) => Object.keys(value).length > 1, {
    message: 'Include at least one field to update.',
  })

export const tradeListQuerySchema = z
  .object({
    includeDeleted: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    accountId: objectIdSchema.optional(),
    instrumentId: objectIdSchema.optional(),
    outcome: z.enum(['win', 'loss', 'break_even']).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  })
  .strict()

export const expectedVersionSchema = z.object({
  expectedVersion: z.number().int().min(0),
})

/**
 * Converts validated trade strings into canonical integer units using the
 * instrument snapshot stored on the server. Client-supplied specs are ignored.
 */
export function canonicalizeTradeFinancials(payload, instrumentSpec) {
  const tickSizeMicros = instrumentSpec.tickSizeMicros

  try {
    return {
      direction: payload.direction,
      entryPriceTicks: priceToTicks(payload.entryPrice, tickSizeMicros),
      quantityHundredths: quantityToHundredths(payload.quantity),
      exits: payload.exits.map((exit) => ({
        priceTicks: priceToTicks(exit.price, tickSizeMicros),
        quantityHundredths: quantityToHundredths(exit.quantity),
      })),
      feesMicros: payload.fees == null ? null : dollarsToMicros(payload.fees),
      initialStopPriceTicks:
        payload.initialStopPrice == null
          ? null
          : priceToTicks(payload.initialStopPrice, tickSizeMicros),
      manualRiskMicros: payload.manualRisk == null ? null : dollarsToMicros(payload.manualRisk),
    }
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Invalid financial value.', {
      cause: error,
    })
  }
}
