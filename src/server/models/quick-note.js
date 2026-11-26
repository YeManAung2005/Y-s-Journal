import mongoose from 'mongoose'

const { ObjectId } = mongoose.Schema.Types

const quickNoteSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true },
    text: { type: String, required: true, trim: true },
    version: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
)

quickNoteSchema.index({ userId: 1, date: -1, createdAt: -1 })
quickNoteSchema.index({ userId: 1, deletedAt: 1, date: -1 })

quickNoteSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v
    return ret
  },
})

export const QuickNote = mongoose.models.QuickNote ?? mongoose.model('QuickNote', quickNoteSchema)
