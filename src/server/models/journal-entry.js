import mongoose from 'mongoose'

const { ObjectId } = mongoose.Schema.Types

const journalEntrySchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true },
    highlights: { type: String, default: '' },
    challenges: { type: String, default: '' },
    lessons: { type: String, default: '' },
    gratitude: { type: [String], default: [] },
    mood: { type: Number, min: 1, max: 5, default: null },
    reflection: { type: String, default: '' },
    freeWriting: { type: String, default: '' },
    tomorrowPriorities: { type: [String], default: [] },
    version: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
)

journalEntrySchema.index(
  { userId: 1, date: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: null },
  },
)
journalEntrySchema.index({ userId: 1, date: -1 })
journalEntrySchema.index({ userId: 1, deletedAt: 1, date: -1 })

journalEntrySchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v
    return ret
  },
})

export const JournalEntry =
  mongoose.models.JournalEntry ?? mongoose.model('JournalEntry', journalEntrySchema)
