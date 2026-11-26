import mongoose from 'mongoose'

const { ObjectId } = mongoose.Schema.Types

const accountAdjustmentSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    accountId: { type: ObjectId, ref: 'TradingAccount', required: true },
    type: { type: String, enum: ['deposit', 'withdrawal', 'correction'], required: true },
    signedAmountMicros: { type: Number, required: true },
    date: { type: String, required: true },
    note: { type: String, default: '' },
    version: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
)

accountAdjustmentSchema.index({ userId: 1, accountId: 1, date: 1 })
accountAdjustmentSchema.index({ userId: 1, deletedAt: 1, date: 1 })

accountAdjustmentSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v
    return ret
  },
})

export const AccountAdjustment =
  mongoose.models.AccountAdjustment ?? mongoose.model('AccountAdjustment', accountAdjustmentSchema)
