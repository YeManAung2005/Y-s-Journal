import mongoose from 'mongoose'

const tradingAccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    broker: { type: String, default: '' },
    accountType: { type: String, enum: ['live', 'demo'], default: 'live' },
    startingBalanceMicros: { type: Number, required: true, default: 0 },
    isDefault: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
    version: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
)

tradingAccountSchema.index(
  { userId: 1, isDefault: 1 },
  {
    unique: true,
    partialFilterExpression: { isDefault: true, archivedAt: null },
  },
)
tradingAccountSchema.index({ userId: 1, archivedAt: 1 })

tradingAccountSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v
    return ret
  },
})

export const TradingAccount =
  mongoose.models.TradingAccount ?? mongoose.model('TradingAccount', tradingAccountSchema)
