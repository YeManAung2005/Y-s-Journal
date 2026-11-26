import mongoose from 'mongoose'

const checklistItemSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    text: { type: String, required: true, trim: true },
    sortOrder: { type: Number, default: 0 },
    archivedAt: { type: Date, default: null },
    version: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
)

checklistItemSchema.index({ userId: 1, archivedAt: 1, sortOrder: 1 })

checklistItemSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v
    return ret
  },
})

export const ChecklistItem =
  mongoose.models.ChecklistItem ?? mongoose.model('ChecklistItem', checklistItemSchema)
