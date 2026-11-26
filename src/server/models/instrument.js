import mongoose from 'mongoose'

const instrumentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    symbol: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    pointValueMicros: { type: Number, required: true },
    tickValueMicros: { type: Number, required: true },
    tickSizeMicros: { type: Number, required: true },
    active: { type: Boolean, default: true },
    builtIn: { type: Boolean, default: false },
    version: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
)

instrumentSchema.index({ userId: 1, symbol: 1 }, { unique: true })
instrumentSchema.index({ userId: 1, active: 1 })

instrumentSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v
    return ret
  },
})

export const Instrument =
  mongoose.models.Instrument ?? mongoose.model('Instrument', instrumentSchema)
