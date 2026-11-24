import { randomUUID } from 'node:crypto'
import mongoose from 'mongoose'

const appMetaSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'app' },
    instanceId: { type: String, default: () => randomUUID() },
    schemaVersion: { type: Number, default: 1 },
    ownerSetupComplete: { type: Boolean, default: false },
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    onboardingCompletedAt: { type: Date, default: null },
  },
  { timestamps: true, _id: false },
)

export const AppMeta = mongoose.models.AppMeta ?? mongoose.model('AppMeta', appMetaSchema)
