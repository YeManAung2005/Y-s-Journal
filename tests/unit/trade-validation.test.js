import { describe, expect, it } from 'vitest'
import {
  canonicalizeTradeFinancials,
  tradeCreateSchema,
  tradePatchSchema,
} from '../../src/shared/validation/trade.js'

const ID = '665f1c2a9b8d4e3f2a1b0c9d'
const SPEC = { tickSizeMicros: 250_000, tickValueMicros: 5_000_000 }

function validPayload(overrides = {}) {
  return {
    accountId: ID,
    instrumentId: ID,
    tradeDate: '2026-11-24',
    direction: 'long',
    entryPrice: '25000.00',
    quantity: '3.00',
    exits: [{ price: '25020.00', quantity: '3.00' }],
    fees: '15.00',
    initialStopPrice: '24990.00',
    manualRisk: null,
    ...overrides,
  }
}

describe('trade validation', () => {
  it('normalizes defaults and rejects duplicate tags', () => {
    const parsed = tradeCreateSchema.parse(validPayload())
    expect(parsed.tagIds).toEqual([])
    expect(parsed.checklist).toEqual([])
    expect(parsed.emotions).toEqual([])
    expect(parsed.review).toMatchObject({
      followedPlan: null,
      whatWentWell: '',
      confidence: null,
      reviewedAt: null,
    })

    expect(() => tradeCreateSchema.parse(validPayload({ tagIds: [ID, ID] }))).toThrow(
      /cannot be added twice/,
    )
  })

  it('converts validated values with the server instrument spec', () => {
    const canonical = canonicalizeTradeFinancials(tradeCreateSchema.parse(validPayload()), SPEC)
    expect(canonical).toMatchObject({
      entryPriceTicks: 100_000,
      quantityHundredths: 300,
      feesMicros: 15_000_000,
      initialStopPriceTicks: 99_960,
      manualRiskMicros: null,
    })
  })

  it('rejects off-tick prices using the stored instrument spec', () => {
    expect(() =>
      canonicalizeTradeFinancials(
        tradeCreateSchema.parse(validPayload({ entryPrice: '25000.10' })),
        SPEC,
      ),
    ).toThrow(/tick size/i)
  })

  it('requires expectedVersion on updates', () => {
    expect(() => tradePatchSchema.parse({ notes: 'Updated' })).toThrow()
    expect(tradePatchSchema.parse({ expectedVersion: 2, notes: 'Updated' })).toMatchObject({
      expectedVersion: 2,
      notes: 'Updated',
    })
  })
})
