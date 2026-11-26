import mongoose from 'mongoose'

const { ObjectId } = mongoose.Schema.Types

const accountSnapshotSchema = new mongoose.Schema(
  {
    id: { type: ObjectId, required: true },
    name: { type: String, required: true },
    broker: { type: String, default: '' },
    accountType: { type: String, enum: ['live', 'demo'], required: true },
    startingBalanceMicros: { type: Number, required: true },
  },
  { _id: false },
)

const instrumentSnapshotSchema = new mongoose.Schema(
  {
    id: { type: ObjectId, required: true },
    symbol: { type: String, required: true },
    name: { type: String, required: true },
    pointValueMicros: { type: Number, required: true },
    tickValueMicros: { type: Number, required: true },
    tickSizeMicros: { type: Number, required: true },
  },
  { _id: false },
)

const sessionSnapshotSchema = new mongoose.Schema(
  {
    id: { type: ObjectId, required: true },
    name: { type: String, required: true },
    color: { type: String, required: true },
  },
  { _id: false },
)

const tagSnapshotSchema = new mongoose.Schema(
  {
    id: { type: ObjectId, required: true },
    type: { type: String, enum: ['setup', 'market_condition', 'custom'], required: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    color: { type: String, required: true },
  },
  { _id: false },
)

const checklistSnapshotSchema = new mongoose.Schema(
  {
    itemId: { type: ObjectId, required: true },
    text: { type: String, required: true },
    checked: { type: Boolean, default: false },
  },
  { _id: false },
)

const exitSchema = new mongoose.Schema(
  {
    priceTicks: { type: Number, required: true },
    price: { type: String, required: true },
    quantityHundredths: { type: Number, required: true },
    grossPnlMicros: { type: Number, required: true },
    allocatedFeeMicros: { type: Number, default: null },
    netPnlMicros: { type: Number, default: null },
  },
  { _id: false },
)

const reviewSchema = new mongoose.Schema(
  {
    followedPlan: { type: String, enum: ['yes', 'no', 'partial'], default: null },
    whatWentWell: { type: String, default: '' },
    whatToImprove: { type: String, default: '' },
    confidence: { type: Number, min: 1, max: 5, default: null },
    reviewedAt: { type: String, default: null },
  },
  { _id: false },
)

const tradeSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true, index: true },

    accountId: { type: ObjectId, ref: 'TradingAccount', required: true },
    accountSnapshot: { type: accountSnapshotSchema, required: true },
    instrumentId: { type: ObjectId, ref: 'Instrument', required: true },
    instrumentSnapshot: { type: instrumentSnapshotSchema, required: true },

    direction: { type: String, enum: ['long', 'short'], required: true },
    entryPriceTicks: { type: Number, required: true },
    quantityHundredths: { type: Number, required: true },
    tradeDate: { type: String, required: true },

    sessionId: { type: ObjectId, ref: 'TradingSession', default: null },
    sessionSnapshot: { type: sessionSnapshotSchema, default: null },
    initialStopPriceTicks: { type: Number, default: null },

    exits: { type: [exitSchema], required: true },
    feesMicros: { type: Number, default: null },
    manualRiskMicros: { type: Number, default: null },
    automaticRiskMicros: { type: Number, default: null },
    selectedRiskMicros: { type: Number, default: null },

    tagIds: { type: [ObjectId], default: [] },
    tags: { type: [tagSnapshotSchema], default: [] },
    checklist: { type: [checklistSnapshotSchema], default: [] },

    emotions: { type: [String], default: [] },
    ruleViolations: { type: [String], default: [] },
    notes: { type: String, default: '' },
    lessons: { type: String, default: '' },
    review: { type: reviewSchema, default: () => ({}) },

    grossPnlMicros: { type: Number, required: true },
    netPnlMicros: { type: Number, default: null },
    grossR: { type: String, default: null },
    weightedAverageExitTicks: { type: String, required: true },
    weightedAverageExitPrice: { type: String, required: true },
    outcomeGross: { type: String, enum: ['win', 'loss', 'break_even'], required: true },
    outcomeNet: { type: String, enum: ['win', 'loss', 'break_even'], default: null },
    formulaVersion: { type: String, required: true },
    calculatedAt: { type: Date, required: true },

    version: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
)

tradeSchema.index({ userId: 1, tradeDate: -1, createdAt: -1 })
tradeSchema.index({ userId: 1, accountId: 1, tradeDate: -1 })
tradeSchema.index({ userId: 1, instrumentId: 1, tradeDate: -1 })
tradeSchema.index({ userId: 1, sessionId: 1, tradeDate: -1 })
tradeSchema.index({ userId: 1, tags: 1, tradeDate: -1 })
tradeSchema.index({ userId: 1, outcomeGross: 1, tradeDate: -1 })
tradeSchema.index({ userId: 1, deletedAt: 1, tradeDate: -1 })

tradeSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v
    return ret
  },
})

export const Trade = mongoose.models.Trade ?? mongoose.model('Trade', tradeSchema)
