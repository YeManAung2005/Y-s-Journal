import mongoose from 'mongoose'

const { ObjectId, Mixed } = mongoose.Schema.Types

const syncOperationSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    key: { type: String, required: true, trim: true, maxlength: 120 },
    method: { type: String, required: true },
    path: { type: String, required: true },
    status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
    statusCode: { type: Number, default: null },
    response: { type: Mixed, default: null },
    error: { type: Mixed, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
)

syncOperationSchema.index({ userId: 1, key: 1 }, { unique: true })
syncOperationSchema.index({ userId: 1, createdAt: -1 })

syncOperationSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v
    return ret
  },
})

export const SyncOperation =
  mongoose.models.SyncOperation ?? mongoose.model('SyncOperation', syncOperationSchema)
