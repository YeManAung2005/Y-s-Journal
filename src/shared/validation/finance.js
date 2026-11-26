import { z } from 'zod'
import { dollarsToMicros, priceToTicks, quantityToHundredths } from '../finance/units.js'

export const positiveMoney = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/, 'Enter a non-negative amount with up to 6 decimals.')

export const priceString = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/, 'Enter a non-negative price.')

export const quantityString = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/, 'Enter a quantity with up to 2 decimals.')

export const instrumentSpecFields = z.object({
  pointValueMicros: z.number().int().positive(),
  tickValueMicros: z.number().int().positive(),
  tickSizeMicros: z.number().int().positive(),
})

export const instrumentSpecSchema = instrumentSpecFields.refine(
  (spec) =>
    BigInt(spec.pointValueMicros) * BigInt(spec.tickSizeMicros) ===
    BigInt(spec.tickValueMicros) * 1_000_000n,
  'Point value must equal tick value divided by tick size.',
)

const exitDraftSchema = z.object({
  price: priceString,
  quantity: quantityString,
})

export const calculateTradeSchema = z
  .object({
    direction: z.enum(['long', 'short']),
    instrument: instrumentSpecSchema,
    entryPrice: priceString,
    quantity: quantityString,
    exits: z.array(exitDraftSchema).min(1).max(50),
    fees: positiveMoney.nullable().optional(),
    initialStopPrice: priceString.nullable().optional(),
    manualRisk: positiveMoney.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    const tickSize = value.instrument.tickSizeMicros
    const checks = [
      ['entryPrice', () => priceToTicks(value.entryPrice, tickSize)],
      ['quantity', () => quantityToHundredths(value.quantity)],
      ...value.exits.flatMap((exit, index) => [
        [`exits.${index}.price`, () => priceToTicks(exit.price, tickSize)],
        [`exits.${index}.quantity`, () => quantityToHundredths(exit.quantity)],
      ]),
    ]

    if (value.initialStopPrice != null) {
      checks.push(['initialStopPrice', () => priceToTicks(value.initialStopPrice, tickSize)])
    }
    if (value.fees != null) checks.push(['fees', () => dollarsToMicros(value.fees)])
    if (value.manualRisk != null)
      checks.push(['manualRisk', () => dollarsToMicros(value.manualRisk)])

    for (const [path, check] of checks) {
      try {
        check()
      } catch (error) {
        ctx.addIssue({
          code: 'custom',
          path: path.split('.'),
          message: error instanceof Error ? error.message : 'Invalid financial value.',
        })
      }
    }
  })
  .transform((value) => {
    const tickSize = value.instrument.tickSizeMicros
    return {
      direction: value.direction,
      instrument: value.instrument,
      entryPriceTicks: priceToTicks(value.entryPrice, tickSize),
      quantityHundredths: quantityToHundredths(value.quantity),
      exits: value.exits.map((exit) => ({
        priceTicks: priceToTicks(exit.price, tickSize),
        quantityHundredths: quantityToHundredths(exit.quantity),
      })),
      feesMicros: value.fees == null ? null : dollarsToMicros(value.fees),
      initialStopPriceTicks:
        value.initialStopPrice == null ? null : priceToTicks(value.initialStopPrice, tickSize),
      manualRiskMicros: value.manualRisk == null ? null : dollarsToMicros(value.manualRisk),
    }
  })
