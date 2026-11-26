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

const milestoneSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  dueDate: { type: String, default: null },
  completedAt: { type: Date, default: null },
})

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  completedAt: { type: Date, default: null },
})

const learningGoalSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    categoryId: { type: ObjectId, ref: 'LearningCategory', default: null },
    categorySnapshot: { type: categorySnapshotSchema, default: null },
    targetDate: { type: String, default: null },
    status: { type: String, enum: ['active', 'completed'], default: 'active' },
    progressPercent: { type: Number, min: 0, max: 100, default: 0 },
    milestones: { type: [milestoneSchema], default: [] },
    tasks: { type: [taskSchema], default: [] },
    completedAt: { type: Date, default: null },
    version: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
)

learningGoalSchema.index({ userId: 1, status: 1, targetDate: 1 })
learningGoalSchema.index({ userId: 1, categoryId: 1, status: 1 })
learningGoalSchema.index({ userId: 1, deletedAt: 1, createdAt: -1 })

learningGoalSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v
    return ret
  },
})

export const LearningGoal =
  mongoose.models.LearningGoal ?? mongoose.model('LearningGoal', learningGoalSchema)
