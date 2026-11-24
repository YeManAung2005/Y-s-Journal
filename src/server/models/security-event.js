import mongoose from 'mongoose'

export const SECURITY_EVENT_TYPES = Object.freeze([
  'login_success',
  'login_failed',
  'logout',
  'unlock_success',
  'unlock_failed',
  'password_changed',
  'onboarding_completed',
  'rate_limited',
  'csrf_rejected',
  'session_expired',
  'access_denied',
])

const securityEventSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    type: { type: String, enum: SECURITY_EVENT_TYPES, required: true },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null, maxlength: 512 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

securityEventSchema.index({ userId: 1, createdAt: -1 })

export const SecurityEvent =
  mongoose.models.SecurityEvent ?? mongoose.model('SecurityEvent', securityEventSchema)
