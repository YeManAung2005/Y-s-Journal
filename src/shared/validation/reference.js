import { z } from 'zod'
import { instrumentSpecFields } from './finance.js'

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid record ID.')

export const versionSchema = z.number().int().min(0)

export const includeArchivedSchema = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true')

const nameSchema = z.string().trim().min(1, 'Name is required.').max(80)
const colorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex color such as #7c3aed.')

const moneyString = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/, 'Enter a non-negative amount with up to 6 decimals.')

const instrumentFields = z
  .object({
    symbol: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{1,10}$/, 'Use 1–10 letters or numbers.'),
    name: nameSchema,
    active: z.boolean().default(true),
    ...instrumentSpecFields.shape,
  })
  .strict()

export const instrumentCreateSchema = instrumentFields.refine(
  (spec) =>
    BigInt(spec.pointValueMicros) * BigInt(spec.tickSizeMicros) ===
    BigInt(spec.tickValueMicros) * 1_000_000n,
  'Point value must equal tick value divided by tick size.',
)

export const instrumentPatchSchema = instrumentFields
  .partial()
  .extend({ expectedVersion: versionSchema })
  .strict()

export const accountCreateSchema = z
  .object({
    name: nameSchema,
    broker: z.string().trim().max(80).default(''),
    accountType: z.enum(['live', 'demo']).default('live'),
    startingBalance: moneyString.default('0'),
    isDefault: z.boolean().default(false),
  })
  .strict()

export const accountPatchSchema = accountCreateSchema
  .partial()
  .extend({ expectedVersion: versionSchema })
  .strict()

export const tagCreateSchema = z
  .object({
    type: z.enum(['setup', 'market_condition', 'custom']),
    name: nameSchema,
    color: colorSchema.default('#64748b'),
  })
  .strict()

export const tagPatchSchema = tagCreateSchema
  .partial()
  .extend({ expectedVersion: versionSchema })
  .strict()

export const tradingSessionCreateSchema = z
  .object({
    name: nameSchema,
    color: colorSchema.default('#64748b'),
    displayOrder: z.number().int().min(0).max(999).default(0),
  })
  .strict()

export const tradingSessionPatchSchema = tradingSessionCreateSchema
  .partial()
  .extend({ expectedVersion: versionSchema })
  .strict()

export const checklistCreateSchema = z
  .object({
    text: z.string().trim().min(1, 'Checklist text is required.').max(240),
    sortOrder: z.number().int().min(0).max(9999).default(0),
  })
  .strict()

export const checklistPatchSchema = checklistCreateSchema
  .partial()
  .extend({ expectedVersion: versionSchema })
  .strict()
