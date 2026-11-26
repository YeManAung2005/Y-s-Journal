import mongoose from 'mongoose'

const { ObjectId } = mongoose.Schema.Types

const learningCategorySchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true },
    color: { type: String, default: '#8b5cf6' },
    archivedAt: { type: Date, default: null },
    version: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
)

learningCategorySchema.index({ userId: 1, slug: 1 }, { unique: true })
learningCategorySchema.index({ userId: 1, archivedAt: 1, name: 1 })

learningCategorySchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v
    return ret
  },
})

export const LearningCategory =
  mongoose.models.LearningCategory ?? mongoose.model('LearningCategory', learningCategorySchema)
