import { Router } from 'express'
import { calculateTradeSchema } from '../../shared/validation/finance.js'
import { HttpError, parse } from '../lib/http-error.js'
import { requireAuth } from '../middleware/auth.js'
import { calculateTrade } from '../services/financial-engine.js'

export const financeRouter = Router()

financeRouter.post('/finance/calculate', requireAuth, (req, res) => {
  const input = parse(calculateTradeSchema, req.body ?? {})

  let calculation
  try {
    calculation = calculateTrade(input)
  } catch (error) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      error instanceof Error ? error.message : 'The trade could not be calculated.',
    )
  }

  res.setHeader('Cache-Control', 'no-store')
  res.json({ data: { calculation } })
})
