import { z } from 'zod'
import { dollarsToMicros } from '../finance/units.js'
import { objectIdSchema } from './reference.js'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date in YYYY-MM-DD format.')

const signedMoney = z
  .string()
  .trim()
  .regex(/^-?(?:0|[1-9]\d*)(?:\.\d{1,6})?$/, 'Enter an amount with up to 6 decimals.')

export const accountAdjustmentCreateSchema = z
  .object({
    accountId: objectIdSchema,
    type: z.enum(['deposit', 'withdrawal', 'correction']),
    amount: signedMoney,
    date: isoDate,
    note: z.string().trim().max(500).default(''),
  })
  .strict()

export const accountAdjustmentDeleteSchema = z.object({
  expectedVersion: z.number().int().min(0),
})

/**
 * Convert an adjustment to signed integer micro-USD. Deposits add, withdrawals
 * subtract, and corrections carry their own sign. Zero is never a valid adjustment.
 */
export function canonicalizeAdjustmentAmount(payload) {
  let amountMicros
  try {
    amountMicros = dollarsToMicros(payload.amount)
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Invalid adjustment amount.', {
      cause: error,
    })
  }

  if (payload.type === 'correction') {
    if (amountMicros === 0) throw new Error('A correction must not be zero.')
    return amountMicros
  }

  if (amountMicros <= 0) {
    throw new Error(`${payload.type} amounts must be greater than zero.`)
  }

  return payload.type === 'withdrawal' ? -amountMicros : amountMicros
}
