import Decimal from 'decimal.js'

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP })

export const MICROS_PER_DOLLAR = 1_000_000
export const HUNDREDTHS_PER_QUANTITY = 100

export function assertSafeInteger(value, label = 'Value') {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer.`)
  }
  return value
}

export function dollarsToMicros(value) {
  const amount = new Decimal(value)
  if (!amount.isFinite()) throw new Error('Money must be a finite number.')

  const micros = amount.times(MICROS_PER_DOLLAR)
  if (!micros.isInteger()) {
    throw new Error('Money must not have more than six decimal places.')
  }

  return assertSafeInteger(micros.toNumber(), 'Money')
}

export function microsToDollars(micros) {
  assertSafeInteger(micros, 'Money')
  return new Decimal(micros).div(MICROS_PER_DOLLAR).toString()
}

export function priceToTicks(price, tickSizeMicros) {
  assertSafeInteger(tickSizeMicros, 'Tick size')
  if (tickSizeMicros <= 0) throw new Error('Tick size must be positive.')

  const priceMicros = dollarsToMicros(price)
  const ticks = new Decimal(priceMicros).div(tickSizeMicros)
  if (!ticks.isInteger()) {
    throw new Error('Price must align exactly to the instrument tick size.')
  }

  return assertSafeInteger(ticks.toNumber(), 'Price ticks')
}

export function ticksToPrice(ticks, tickSizeMicros) {
  assertSafeInteger(tickSizeMicros, 'Tick size')
  if (tickSizeMicros <= 0) throw new Error('Tick size must be positive.')

  return new Decimal(ticks).times(tickSizeMicros).div(MICROS_PER_DOLLAR).toString()
}

export function quantityToHundredths(quantity) {
  const amount = new Decimal(quantity)
  if (!amount.isFinite() || amount.isNegative()) {
    throw new Error('Quantity must be a non-negative number.')
  }

  const hundredths = amount.times(HUNDREDTHS_PER_QUANTITY)
  if (!hundredths.isInteger()) {
    throw new Error('Quantity must not have more than two decimal places.')
  }

  return assertSafeInteger(hundredths.toNumber(), 'Quantity')
}

export function hundredthsToQuantity(hundredths) {
  assertSafeInteger(hundredths, 'Quantity')
  return new Decimal(hundredths).div(HUNDREDTHS_PER_QUANTITY).toString()
}

export function decimalString(value) {
  return new Decimal(value).toSignificantDigits(12).toString()
}
