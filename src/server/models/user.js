import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    displayName: { type: String, required: true, trim: true, maxlength: 80 },
    role: { type: String, enum: ['owner'], default: 'owner' },
    passwordVersion: { type: Number, default: 1, min: 1 },
    failedLoginCount: { type: Number, default: 0, min: 0 },
    lastFailedLoginAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
)

userSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.passwordHash
    delete ret.__v
    return ret
  },
})

export const User = mongoose.models.User ?? mongoose.model('User', userSchema)
