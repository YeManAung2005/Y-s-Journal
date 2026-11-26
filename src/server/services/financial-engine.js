import Decimal from 'decimal.js'
import { assertSafeInteger, decimalString, ticksToPrice } from '../../shared/finance/units.js'

export const FORMULA_VERSION = '2026-11-24.1'

function positiveInteger(value, label) {
  assertSafeInteger(value, label)
  if (value <= 0) throw new Error(`${label} must be greater than zero.`)
  return value
}

function nonnegativeInteger(value, label) {
  assertSafeInteger(value, label)
  if (value < 0) throw new Error(`${label} must not be negative.`)
  return value
}

export function classifyPnl(micros) {
  assertSafeInteger(micros, 'P&L')
  if (micros > 0) return 'win'
  if (micros < 0) return 'loss'
  return 'break_even'
}

/**
 * Allocates a total fee across exits using largest remainders at micro-USD precision.
 * The returned allocations always sum exactly to the entered total.
 */
export function allocateFees(totalFeesMicros, exitQuantitiesHundredths) {
  nonnegativeInteger(totalFeesMicros, 'Total fees')
  if (!Array.isArray(exitQuantitiesHundredths) || exitQuantitiesHundredths.length === 0) {
    throw new Error('At least one exit quantity is required.')
  }

  const weights = exitQuantitiesHundredths.map((value) =>
    BigInt(positiveInteger(value, 'Exit quantity')),
  )
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0n)
  const total = BigInt(totalFeesMicros)

  if (total === 0n) return exitQuantitiesHundredths.map(() => 0)

  const shares = weights.map((weight) => (total * weight) / totalWeight)
  const remainders = weights.map((weight, index) => ({
    index,
    remainder: (total * weight) % totalWeight,
  }))

  remainders.sort((a, b) => {
    if (a.remainder === b.remainder) return a.index - b.index
    return a.remainder > b.remainder ? -1 : 1
  })

  let leftover = Number(total - shares.reduce((sum, share) => sum + share, 0n))
  for (const { index } of remainders) {
    if (leftover === 0) break
    shares[index] += 1n
    leftover -= 1
  }

  return shares.map((share) => Number(share))
}

function exitPnlMicros({ direction, entryTicks, exitTicks, tickValueMicros, quantityHundredths }) {
  const signedTicks = direction === 'long' ? exitTicks - entryTicks : entryTicks - exitTicks
  const value = new Decimal(signedTicks).times(tickValueMicros).times(quantityHundredths).div(100)

  return assertSafeInteger(value.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber(), 'Exit P&L')
}

/**
 * Recomputes a completed trade from canonical integer units.
 * No trade values are trusted from the client.
 */
export function calculateTrade(input) {
  if (input?.direction !== 'long' && input?.direction !== 'short') {
    throw new Error('Direction must be long or short.')
  }

  const tickValueMicros = positiveInteger(input.instrument?.tickValueMicros, 'Tick value')
  const tickSizeMicros = positiveInteger(input.instrument?.tickSizeMicros, 'Tick size')
  const entryTicks = positiveInteger(input.entryPriceTicks, 'Entry price')
  const quantityHundredths = positiveInteger(input.quantityHundredths, 'Quantity')

  if (!Array.isArray(input.exits) || input.exits.length === 0) {
    throw new Error('At least one exit is required.')
  }

  const normalizedExits = input.exits.map((exit) => ({
    priceTicks: positiveInteger(exit?.priceTicks, 'Exit price'),
    quantityHundredths: positiveInteger(exit?.quantityHundredths, 'Exit quantity'),
  }))

  const exitedQuantity = normalizedExits.reduce((sum, exit) => sum + exit.quantityHundredths, 0)
  if (exitedQuantity !== quantityHundredths) {
    throw new Error('Exit quantities must sum exactly to the trade quantity.')
  }

  let initialStopPriceTicks = null
  if (input.initialStopPriceTicks !== null && input.initialStopPriceTicks !== undefined) {
    initialStopPriceTicks = positiveInteger(input.initialStopPriceTicks, 'Initial stop')
    const stopIsValid =
      input.direction === 'long'
        ? initialStopPriceTicks < entryTicks
        : initialStopPriceTicks > entryTicks
    if (!stopIsValid) {
      throw new Error('A long stop must be below entry and a short stop must be above entry.')
    }
  }

  let feesMicros = null
  if (input.feesMicros !== null && input.feesMicros !== undefined) {
    feesMicros = nonnegativeInteger(input.feesMicros, 'Fees')
  }

  let manualRiskMicros = null
  if (input.manualRiskMicros !== null && input.manualRiskMicros !== undefined) {
    manualRiskMicros = positiveInteger(input.manualRiskMicros, 'Manual risk')
  }

  const exitCalculations = normalizedExits.map((exit) => ({
    priceTicks: exit.priceTicks,
    price: ticksToPrice(exit.priceTicks, tickSizeMicros),
    quantityHundredths: exit.quantityHundredths,
    grossPnlMicros: exitPnlMicros({
      direction: input.direction,
      entryTicks,
      exitTicks: exit.priceTicks,
      tickValueMicros,
      quantityHundredths: exit.quantityHundredths,
    }),
  }))

  const grossPnlMicros = exitCalculations.reduce((sum, exit) => sum + exit.grossPnlMicros, 0)
  const netPnlMicros = feesMicros === null ? null : grossPnlMicros - feesMicros

  const feeAllocationsMicros =
    feesMicros === null
      ? null
      : allocateFees(
          feesMicros,
          exitCalculations.map((exit) => exit.quantityHundredths),
        )

  exitCalculations.forEach((exit, index) => {
    exit.allocatedFeeMicros = feeAllocationsMicros ? feeAllocationsMicros[index] : null
    exit.netPnlMicros =
      feeAllocationsMicros === null ? null : exit.grossPnlMicros - feeAllocationsMicros[index]
  })

  const automaticRiskMicros =
    initialStopPriceTicks === null
      ? null
      : Math.abs(
          exitPnlMicros({
            direction: input.direction,
            entryTicks,
            exitTicks: initialStopPriceTicks,
            tickValueMicros,
            quantityHundredths,
          }),
        )

  const selectedRiskMicros =
    manualRiskMicros ??
    (automaticRiskMicros && automaticRiskMicros > 0 ? automaticRiskMicros : null)

  const grossR =
    selectedRiskMicros === null
      ? null
      : decimalString(new Decimal(grossPnlMicros).div(selectedRiskMicros))

  const totalExitWeight = normalizedExits.reduce((sum, exit) => sum + exit.quantityHundredths, 0)
  const weightedAverageExitTicks = new Decimal(
    normalizedExits.reduce((sum, exit) => sum + exit.priceTicks * exit.quantityHundredths, 0),
  )
    .div(totalExitWeight)
    .toString()

  return {
    formulaVersion: FORMULA_VERSION,
    calculatedAt: new Date().toISOString(),
    direction: input.direction,
    entryPriceTicks: entryTicks,
    quantityHundredths,
    instrument: { tickValueMicros, tickSizeMicros },
    exits: exitCalculations,
    grossPnlMicros,
    netPnlMicros,
    feesMicros,
    feeAllocationsMicros,
    outcomeGross: classifyPnl(grossPnlMicros),
    outcomeNet: netPnlMicros === null ? null : classifyPnl(netPnlMicros),
    initialStopPriceTicks,
    automaticRiskMicros,
    manualRiskMicros,
    selectedRiskMicros,
    grossR,
    weightedAverageExitTicks,
    weightedAverageExitPrice: ticksToPrice(weightedAverageExitTicks, tickSizeMicros),
  }
}
