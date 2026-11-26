import mongoose from 'mongoose'

const tagSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['setup', 'market_condition', 'custom'],
      required: true,
    },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true },
    color: { type: String, default: '#64748b' },
    builtIn: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
    version: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
)

tagSchema.index({ userId: 1, type: 1, slug: 1 }, { unique: true })
tagSchema.index({ userId: 1, archivedAt: 1 })

tagSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v
    return ret
  },
})

export const Tag = mongoose.models.Tag ?? mongoose.model('Tag', tagSchema)
