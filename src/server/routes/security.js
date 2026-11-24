import { Router } from 'express'
import { securityEventsQuerySchema } from '../../shared/validation/auth.js'
import { parse } from '../lib/http-error.js'
import { requireAuth } from '../middleware/auth.js'
import { SecurityEvent } from '../models/security-event.js'

export const securityRouter = Router()

function serializeEvent(event) {
  return {
    id: event._id.toString(),
    type: event.type,
    ip: event.ip,
    userAgent: event.userAgent,
    metadata: event.metadata ?? {},
    createdAt: event.createdAt,
  }
}

securityRouter.get('/security/events', requireAuth, async (req, res) => {
  const { limit } = parse(securityEventsQuerySchema, req.query ?? {})

  const events = await SecurityEvent.find({
    $or: [{ userId: req.user._id }, { userId: null }],
  })
    .sort({ createdAt: -1 })
    .limit(limit)

  res.setHeader('Cache-Control', 'no-store')
  res.json({ data: { events: events.map(serializeEvent) } })
})
