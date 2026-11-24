import { SecurityEvent } from '../models/security-event.js'

export async function recordSecurityEvent({
  type,
  userId = null,
  req = null,
  metadata = {},
  logger,
}) {
  try {
    await SecurityEvent.create({
      type,
      userId,
      ip: req?.ip ?? null,
      userAgent: req?.get?.('user-agent')?.slice(0, 512) ?? null,
      metadata,
    })
  } catch (error) {
    logger?.warn({ err: error, type }, 'Failed to record security event')
  }
}
