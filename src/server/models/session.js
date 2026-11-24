import mongoose from 'mongoose'

const sessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    lastActivityAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null, maxlength: 512 },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
sessionSchema.index({ userId: 1, revokedAt: 1 })

export const Session = mongoose.models.Session ?? mongoose.model('Session', sessionSchema)
