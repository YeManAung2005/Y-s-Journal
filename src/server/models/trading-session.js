import mongoose from 'mongoose'

const tradingSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true },
    color: { type: String, default: '#64748b' },
    displayOrder: { type: Number, default: 0 },
    archivedAt: { type: Date, default: null },
    version: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
)

tradingSessionSchema.index({ userId: 1, slug: 1 }, { unique: true })
tradingSessionSchema.index({ userId: 1, archivedAt: 1, displayOrder: 1 })

tradingSessionSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v
    return ret
  },
})

export const TradingSession =
  mongoose.models.TradingSession ?? mongoose.model('TradingSession', tradingSessionSchema)
