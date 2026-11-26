import { randomUUID } from 'node:crypto'
import { AppMeta } from '../models/app-meta.js'
import { Settings } from '../models/settings.js'
import { User } from '../models/user.js'
import { HttpError } from '../lib/http-error.js'
import { getDummyPasswordHash, hashPassword, verifyPassword } from '../lib/password.js'
import { recordSecurityEvent } from './security-service.js'
import { ensureReferenceData } from './reference-data-service.js'
import { createSession, revokeOtherSessions } from './session-service.js'

const MAX_PROGRESSIVE_DELAY_MS = 3000
const BASE_PROGRESSIVE_DELAY_MS = 200

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function progressiveDelay(failedLoginCount) {
  if (!Number.isFinite(failedLoginCount) || failedLoginCount <= 0) return 0
  return Math.min(BASE_PROGRESSIVE_DELAY_MS * 2 ** (failedLoginCount - 1), MAX_PROGRESSIVE_DELAY_MS)
}

export function serializeUser(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  }
}

export async function isSetupRequired() {
  const existing = await User.exists({})
  return !existing
}

export async function createOwner({ email, displayName, password, req, logger }) {
  if (!(await isSetupRequired())) {
    throw new HttpError(409, 'SETUP_COMPLETE', 'The owner account has already been created.')
  }

  const passwordHash = await hashPassword(password)

  let user
  try {
    user = await User.create({ email, displayName, passwordHash, role: 'owner' })
  } catch (error) {
    if (error?.code === 11000) {
      throw new HttpError(409, 'SETUP_COMPLETE', 'The owner account has already been created.')
    }
    throw error
  }

  await Settings.create({ userId: user._id })
  await ensureReferenceData(user._id)

  await AppMeta.findOneAndUpdate(
    { _id: 'app' },
    {
      $set: {
        ownerSetupComplete: true,
        ownerUserId: user._id,
        onboardingCompletedAt: new Date(),
      },
      $setOnInsert: { instanceId: randomUUID(), schemaVersion: 1 },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  )

  await recordSecurityEvent({
    type: 'onboarding_completed',
    userId: user._id,
    req,
    logger,
  })

  const { token, session } = await createSession(user._id, {
    ip: req?.ip,
    userAgent: req?.get?.('user-agent'),
  })

  return { user, session, token }
}

export async function login({ email, password, req, logger }) {
  const user = await User.findOne({ email }).select('+passwordHash')

  if (!user) {
    await verifyPassword(await getDummyPasswordHash(), password)
    await recordSecurityEvent({
      type: 'login_failed',
      req,
      metadata: { reason: 'unknown_email' },
      logger,
    })
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.')
  }

  const delay = progressiveDelay(user.failedLoginCount)
  if (delay > 0) await sleep(delay)

  const valid = await verifyPassword(user.passwordHash, password)

  if (!valid) {
    user.failedLoginCount += 1
    user.lastFailedLoginAt = new Date()
    await user.save()
    await recordSecurityEvent({
      type: 'login_failed',
      userId: user._id,
      req,
      metadata: { reason: 'invalid_password' },
      logger,
    })
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.')
  }

  user.failedLoginCount = 0
  user.lastFailedLoginAt = null
  user.lastLoginAt = new Date()
  await user.save()

  const { token, session } = await createSession(user._id, {
    ip: req?.ip,
    userAgent: req?.get?.('user-agent'),
  })

  await recordSecurityEvent({ type: 'login_success', userId: user._id, req, logger })

  return { user, session, token }
}

export async function verifyOwnerPassword(userId, password) {
  const user = await User.findById(userId).select('+passwordHash')
  if (!user) {
    throw new HttpError(401, 'AUTH_REQUIRED', 'Authentication is required.')
  }
  const valid = await verifyPassword(user.passwordHash, password)
  return { user, valid }
}

export async function changeOwnerPassword({
  userId,
  currentSessionId,
  currentPassword,
  newPassword,
  req,
  logger,
}) {
  const { user, valid } = await verifyOwnerPassword(userId, currentPassword)

  if (!valid) {
    await recordSecurityEvent({
      type: 'unlock_failed',
      userId,
      req,
      metadata: { reason: 'password_change' },
      logger,
    })
    throw new HttpError(401, 'INVALID_PASSWORD', 'The current password is incorrect.')
  }

  user.passwordHash = await hashPassword(newPassword)
  user.passwordVersion += 1
  await user.save()

  await revokeOtherSessions(user._id, currentSessionId)

  await recordSecurityEvent({ type: 'password_changed', userId, req, logger })

  return user
}
