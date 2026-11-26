import mongoose from 'mongoose'

const { ObjectId } = mongoose.Schema.Types

const categorySnapshotSchema = new mongoose.Schema(
  {
    id: { type: ObjectId, required: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    color: { type: String, required: true },
  },
  { _id: false },
)

const resourceLinkSchema = new mongoose.Schema(
  {
    label: { type: String, default: '' },
    url: { type: String, required: true },
  },
  { _id: false },
)

const learningRecordSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true },
    categoryId: { type: ObjectId, ref: 'LearningCategory', required: true },
    categorySnapshot: { type: categorySnapshotSchema, required: true },
    goalId: { type: ObjectId, ref: 'LearningGoal', default: null },
    topic: { type: String, required: true, trim: true },
    keyTakeaways: { type: String, default: '' },
    durationMinutes: { type: Number, default: 0, min: 0, max: 1440 },
    notes: { type: String, default: '' },
    resources: { type: [resourceLinkSchema], default: [] },
    version: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
)

learningRecordSchema.index({ userId: 1, date: -1, createdAt: -1 })
learningRecordSchema.index({ userId: 1, categoryId: 1, date: -1 })
learningRecordSchema.index({ userId: 1, goalId: 1, date: -1 })
learningRecordSchema.index({ userId: 1, deletedAt: 1, date: -1 })

learningRecordSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v
    return ret
  },
})

export const LearningRecord =
  mongoose.models.LearningRecord ?? mongoose.model('LearningRecord', learningRecordSchema)
