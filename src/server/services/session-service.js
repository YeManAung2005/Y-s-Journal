import { Session } from '../models/session.js'
import { User } from '../models/user.js'
import { SESSION_IDLE_MS } from '../lib/cookies.js'
import { createOpaqueToken, sha256 } from '../lib/tokens.js'

const TOUCH_INTERVAL_MS = 60_000

export async function createSession(userId, { ip, userAgent } = {}) {
  const token = createOpaqueToken()
  const now = new Date()

  const session = await Session.create({
    userId,
    tokenHash: sha256(token),
    lastActivityAt: now,
    expiresAt: new Date(now.getTime() + SESSION_IDLE_MS),
    ip: ip ?? null,
    userAgent: userAgent?.slice(0, 512) ?? null,
  })

  return { token, session }
}

export async function findSessionByToken(token) {
  if (!token) return null
  return Session.findOne({ tokenHash: sha256(token), revokedAt: null })
}

export async function validateSession(token) {
  const session = await findSessionByToken(token)
  if (!session) return null

  const now = new Date()

  if (session.expiresAt.getTime() <= now.getTime()) {
    session.revokedAt = now
    await session.save()
    return { expired: true, session }
  }

  if (now.getTime() - session.lastActivityAt.getTime() > SESSION_IDLE_MS) {
    session.revokedAt = now
    await session.save()
    return { expired: true, session }
  }

  const user = await User.findById(session.userId)
  if (!user) {
    session.revokedAt = now
    await session.save()
    return null
  }

  if (now.getTime() - session.lastActivityAt.getTime() > TOUCH_INTERVAL_MS) {
    session.lastActivityAt = now
    session.expiresAt = new Date(now.getTime() + SESSION_IDLE_MS)
    await session.save()
  }

  return { session, user }
}

export async function revokeSession(session, at = new Date()) {
  if (!session || session.revokedAt) return
  session.revokedAt = at
  await session.save()
}

export async function revokeOtherSessions(userId, currentSessionId) {
  await Session.updateMany(
    { userId, _id: { $ne: currentSessionId }, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  )
}

export async function revokeAllSessions(userId) {
  await Session.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } })
}

export function serializeSession(session) {
  if (!session) return null
  return {
    expiresAt: session.expiresAt,
    lastActivityAt: session.lastActivityAt,
    createdAt: session.createdAt,
  }
}
