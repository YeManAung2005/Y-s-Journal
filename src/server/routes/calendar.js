import { Router } from 'express'
import { parse } from '../lib/http-error.js'
import { requireAuth } from '../middleware/auth.js'
import { calendarQuerySchema } from '../../shared/validation/calendar.js'
import { getCalendarMonth } from '../services/calendar-service.js'

export const calendarRouter = Router()

calendarRouter.get('/calendar/month', requireAuth, async (req, res) => {
  const query = parse(calendarQuerySchema, req.query ?? {})
  res.status(200)
  res.setHeader('Cache-Control', 'no-store')
  res.json({ data: await getCalendarMonth(req.user._id, query.month) })
})
