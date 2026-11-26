import mongoose from 'mongoose'

const { ObjectId } = mongoose.Schema.Types

const fileSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    ownerType: { type: String, enum: ['Trade', 'LearningRecord'], required: true },
    ownerId: { type: ObjectId, required: true },
    originalName: { type: String, required: true },
    storageKey: { type: String, required: true, unique: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    sha256: { type: String, required: true },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    label: { type: String, default: '' },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: ObjectId, ref: 'User', default: null },
    deletedReason: {
      type: String,
      enum: ['manual', 'trade_deleted', 'learning_record_deleted'],
      default: null,
    },
  },
  { timestamps: true, versionKey: false },
)

fileSchema.index({ userId: 1, ownerType: 1, ownerId: 1, deletedAt: 1 })
fileSchema.index({ userId: 1, deletedAt: 1, createdAt: -1 })

fileSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v
    return ret
  },
})

export const FileRecord = mongoose.models.File ?? mongoose.model('File', fileSchema)
