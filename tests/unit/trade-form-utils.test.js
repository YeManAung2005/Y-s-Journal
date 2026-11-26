import { describe, expect, it } from 'vitest'
import { optionalValue } from '../../src/client/features/trades/trade-form-utils.js'

describe('trade form optional values', () => {
  it('keeps blank optional fields missing instead of converting them to zero', () => {
    expect(optionalValue('')).toBeNull()
    expect(optionalValue('   ')).toBeNull()
    expect(optionalValue(null)).toBeNull()
    expect(optionalValue(undefined)).toBeNull()
  })

  it('preserves an explicitly entered zero and trims real values', () => {
    expect(optionalValue('0')).toBe('0')
    expect(optionalValue(' 5.00 ')).toBe('5.00')
  })
})
