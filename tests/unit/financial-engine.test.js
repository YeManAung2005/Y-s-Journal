import { describe, expect, it } from 'vitest'
import {
  allocateFees,
  calculateTrade,
  FORMULA_VERSION,
} from '../../src/server/services/financial-engine.js'
import {
  dollarsToMicros,
  priceToTicks,
  quantityToHundredths,
} from '../../src/shared/finance/units.js'
import { calculateTradeSchema } from '../../src/shared/validation/finance.js'

const TICK_SIZE = 250_000
const INSTRUMENTS = {
  NQ: { tickSizeMicros: TICK_SIZE, tickValueMicros: 5_000_000 },
  ES: { tickSizeMicros: TICK_SIZE, tickValueMicros: 12_500_000 },
  MNQ: { tickSizeMicros: TICK_SIZE, tickValueMicros: 500_000 },
}

function ticks(price) {
  return priceToTicks(price, TICK_SIZE)
}

describe('canonical financial units', () => {
  it('converts money, prices, and quantities to integer units', () => {
    expect(dollarsToMicros('2200.00')).toBe(2_200_000_000)
    expect(ticks('25,000.00'.replace(',', ''))).toBe(100_000)
    expect(quantityToHundredths('1.25')).toBe(125)
  })

  it('rejects prices that do not align to the tick size', () => {
    expect(() => priceToTicks('25000.10', TICK_SIZE)).toThrow(/tick size/i)
    expect(() => quantityToHundredths('1.234')).toThrow(/two decimal places/i)
    expect(() => dollarsToMicros('1.0000001')).toThrow(/six decimal places/i)
  })
})

describe('largest-remainder fee allocation', () => {
  it('allocates fees exactly and favors larger remainders first', () => {
    expect(allocateFees(10_000_000, [100, 100, 100])).toEqual([3_333_334, 3_333_333, 3_333_333])
    expect(allocateFees(10, [1, 1, 1])).toEqual([4, 3, 3])
    expect(allocateFees(0, [100, 25])).toEqual([0, 0])
  })

  it('sums allocated fees to the entered total', () => {
    const allocations = allocateFees(15_000_007, [300, 175, 25])
    expect(allocations.reduce((sum, value) => sum + value, 0)).toBe(15_000_007)
  })
})

describe('financial engine worked fixtures', () => {
  it('calculates the NQ long with three partial exits', () => {
    const result = calculateTrade({
      direction: 'long',
      instrument: INSTRUMENTS.NQ,
      entryPriceTicks: ticks('25000.00'),
      quantityHundredths: 300,
      exits: [
        { priceTicks: ticks('25020.00'), quantityHundredths: 100 },
        { priceTicks: ticks('25040.00'), quantityHundredths: 100 },
        { priceTicks: ticks('25050.00'), quantityHundredths: 100 },
      ],
      feesMicros: 15_000_000,
      initialStopPriceTicks: ticks('24990.00'),
      manualRiskMicros: null,
    })

    expect(result.exits.map((exit) => exit.grossPnlMicros)).toEqual([
      400_000_000, 800_000_000, 1_000_000_000,
    ])
    expect(result.grossPnlMicros).toBe(2_200_000_000)
    expect(result.netPnlMicros).toBe(2_185_000_000)
    expect(result.outcomeGross).toBe('win')
    expect(result.outcomeNet).toBe('win')
    expect(Number(result.weightedAverageExitPrice)).toBeCloseTo(25036.6667, 3)
    expect(result.automaticRiskMicros).toBe(600_000_000)
    expect(result.selectedRiskMicros).toBe(600_000_000)
    expect(Number(result.grossR)).toBeCloseTo(3.6666666667, 9)
    expect(result.feeAllocationsMicros.reduce((sum, value) => sum + value, 0)).toBe(15_000_000)
    expect(result.formulaVersion).toBe(FORMULA_VERSION)
  })

  it('calculates the ES short with two exits', () => {
    const result = calculateTrade({
      direction: 'short',
      instrument: INSTRUMENTS.ES,
      entryPriceTicks: ticks('5000.00'),
      quantityHundredths: 200,
      exits: [
        { priceTicks: ticks('4990.50'), quantityHundredths: 100 },
        { priceTicks: ticks('4995.00'), quantityHundredths: 100 },
      ],
      feesMicros: 8_000_000,
      initialStopPriceTicks: ticks('5010.00'),
      manualRiskMicros: null,
    })

    expect(result.grossPnlMicros).toBe(725_000_000)
    expect(result.netPnlMicros).toBe(717_000_000)
    expect(result.weightedAverageExitPrice).toBe('4992.75')
    expect(result.automaticRiskMicros).toBe(1_000_000_000)
    expect(Number(result.grossR)).toBeCloseTo(0.725, 12)
  })

  it('calculates fractional MNQ quantities', () => {
    const result = calculateTrade({
      direction: 'long',
      instrument: INSTRUMENTS.MNQ,
      entryPriceTicks: ticks('20000.00'),
      quantityHundredths: 25,
      exits: [{ priceTicks: ticks('20010.00'), quantityHundredths: 25 }],
      feesMicros: 1_250_000,
      initialStopPriceTicks: ticks('19990.00'),
      manualRiskMicros: null,
    })

    expect(result.grossPnlMicros).toBe(5_000_000)
    expect(result.netPnlMicros).toBe(3_750_000)
    expect(result.automaticRiskMicros).toBe(5_000_000)
    expect(result.grossR).toBe('1')
  })

  it('preserves automatic risk when manual risk overrides R', () => {
    const base = {
      direction: 'long',
      instrument: INSTRUMENTS.NQ,
      entryPriceTicks: ticks('25000.00'),
      quantityHundredths: 300,
      exits: [
        { priceTicks: ticks('25020.00'), quantityHundredths: 100 },
        { priceTicks: ticks('25040.00'), quantityHundredths: 100 },
        { priceTicks: ticks('25050.00'), quantityHundredths: 100 },
      ],
      feesMicros: 15_000_000,
      initialStopPriceTicks: ticks('24990.00'),
    }

    const result = calculateTrade({ ...base, manualRiskMicros: 500_000_000 })

    expect(result.automaticRiskMicros).toBe(600_000_000)
    expect(result.manualRiskMicros).toBe(500_000_000)
    expect(result.selectedRiskMicros).toBe(500_000_000)
    expect(result.grossR).toBe('4.4')
  })

  it('classifies gross and net outcomes independently', () => {
    const result = calculateTrade({
      direction: 'long',
      instrument: INSTRUMENTS.NQ,
      entryPriceTicks: ticks('25000.00'),
      quantityHundredths: 100,
      exits: [{ priceTicks: ticks('25000.00'), quantityHundredths: 100 }],
      feesMicros: 2_000_000,
      initialStopPriceTicks: null,
      manualRiskMicros: null,
    })

    expect(result.grossPnlMicros).toBe(0)
    expect(result.outcomeGross).toBe('break_even')
    expect(result.netPnlMicros).toBe(-2_000_000)
    expect(result.outcomeNet).toBe('loss')
    expect(result.grossR).toBeNull()
  })

  it('leaves net P&L and outcome unavailable when fees are missing', () => {
    const result = calculateTrade({
      direction: 'long',
      instrument: INSTRUMENTS.NQ,
      entryPriceTicks: ticks('25000.00'),
      quantityHundredths: 100,
      exits: [{ priceTicks: ticks('25020.00'), quantityHundredths: 100 }],
      feesMicros: null,
      initialStopPriceTicks: ticks('24990.00'),
      manualRiskMicros: null,
    })

    expect(result.grossPnlMicros).toBe(400_000_000)
    expect(result.netPnlMicros).toBeNull()
    expect(result.outcomeNet).toBeNull()
    expect(result.feeAllocationsMicros).toBeNull()
  })

  it('rejects invalid stops and exit quantities', () => {
    const trade = {
      direction: 'long',
      instrument: INSTRUMENTS.NQ,
      entryPriceTicks: ticks('25000.00'),
      quantityHundredths: 200,
      exits: [{ priceTicks: ticks('25020.00'), quantityHundredths: 100 }],
      feesMicros: null,
      initialStopPriceTicks: null,
      manualRiskMicros: null,
    }

    expect(() => calculateTrade(trade)).toThrow(/sum exactly/i)
    expect(() =>
      calculateTrade({
        ...trade,
        exits: [{ priceTicks: ticks('25020.00'), quantityHundredths: 200 }],
        initialStopPriceTicks: ticks('25010.00'),
      }),
    ).toThrow(/stop must be below entry/i)
  })
})

describe('calculateTradeSchema', () => {
  it('normalizes formatted request values into canonical units', () => {
    const parsed = calculateTradeSchema.parse({
      direction: 'long',
      instrument: {
        pointValueMicros: 20_000_000,
        tickValueMicros: 5_000_000,
        tickSizeMicros: 250_000,
      },
      entryPrice: '25000.00',
      quantity: '1.00',
      exits: [{ price: '25020.00', quantity: '1.00' }],
      fees: '2.00',
      initialStopPrice: '24990.00',
      manualRisk: null,
    })

    expect(parsed.entryPriceTicks).toBe(100_000)
    expect(parsed.quantityHundredths).toBe(100)
    expect(parsed.exits[0].priceTicks).toBe(100_080)
    expect(parsed.feesMicros).toBe(2_000_000)
  })

  it('rejects inconsistent instrument specifications', () => {
    expect(() =>
      calculateTradeSchema.parse({
        direction: 'long',
        instrument: {
          pointValueMicros: 20_000_000,
          tickValueMicros: 5_000_000,
          tickSizeMicros: 500_000,
        },
        entryPrice: '25000.00',
        quantity: '1',
        exits: [{ price: '25020.00', quantity: '1' }],
      }),
    ).toThrow()
  })
})
