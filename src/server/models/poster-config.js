import mongoose from 'mongoose'

const { ObjectId } = mongoose.Schema.Types

const posterConfigSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    type: { type: String, enum: ['trading', 'learning', 'trade'], required: true },
    template: {
      type: String,
      enum: ['midnight', 'paper', 'ember'],
      default: 'midnight',
    },
    dimension: {
      type: String,
      enum: ['square', 'portrait', 'story'],
      default: 'square',
    },
    accentColor: { type: String, default: '#8b5cf6' },
    headline: { type: String, default: '', trim: true, maxlength: 80 },
    subtitle: { type: String, default: '', trim: true, maxlength: 140 },
    footer: { type: String, default: '', trim: true, maxlength: 100 },
    logoPosition: {
      type: String,
      enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'none'],
      default: 'top-left',
    },
    days: { type: Number, default: 30, min: 7, max: 365 },
    basis: { type: String, enum: ['gross', 'net'], default: 'gross' },
    tradeId: { type: ObjectId, ref: 'Trade', default: null },
    version: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
)

posterConfigSchema.index({ userId: 1, name: 1 }, { unique: true })
posterConfigSchema.index({ userId: 1, updatedAt: -1 })

posterConfigSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v
    return ret
  },
})

export const PosterConfig =
  mongoose.models.PosterConfig ?? mongoose.model('PosterConfig', posterConfigSchema)
