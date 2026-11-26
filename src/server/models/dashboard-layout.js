import mongoose from 'mongoose'

const { ObjectId, Mixed } = mongoose.Schema.Types

const dashboardLayoutSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    isDefault: { type: Boolean, default: false },
    widgets: {
      type: [
        {
          _id: false,
          id: {
            type: String,
            enum: ['trades_summary', 'study_summary', 'calendar_activity', 'goals_progress'],
            required: true,
          },
          visible: { type: Boolean, default: true },
          size: { type: String, enum: ['small', 'medium', 'large'], default: 'medium' },
          position: { type: Number, min: 0, max: 50, required: true },
          settings: { type: Mixed, default: {} },
        },
      ],
      default: [],
    },
    version: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
)

dashboardLayoutSchema.index(
  { userId: 1, isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true } },
)
dashboardLayoutSchema.index({ userId: 1, name: 1 }, { unique: true })
dashboardLayoutSchema.index({ userId: 1, updatedAt: -1 })

dashboardLayoutSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v
    return ret
  },
})

export const DashboardLayout =
  mongoose.models.DashboardLayout ?? mongoose.model('DashboardLayout', dashboardLayoutSchema)
