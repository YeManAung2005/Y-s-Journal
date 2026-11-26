import { ChecklistItem } from '../models/checklist-item.js'
import { Instrument } from '../models/instrument.js'
import { Tag } from '../models/tag.js'
import { TradingAccount } from '../models/trading-account.js'
import { TradingSession } from '../models/trading-session.js'
import { HttpError } from '../lib/http-error.js'
import { dollarsToMicros, microsToDollars } from '../../shared/finance/units.js'

const BUILT_IN_INSTRUMENTS = [
  {
    symbol: 'NQ',
    name: 'Nasdaq 100 (mini)',
    pointValueMicros: 20_000_000,
    tickValueMicros: 5_000_000,
    tickSizeMicros: 250_000,
  },
  {
    symbol: 'MNQ',
    name: 'Micro Nasdaq 100',
    pointValueMicros: 2_000_000,
    tickValueMicros: 500_000,
    tickSizeMicros: 250_000,
  },
  {
    symbol: 'ES',
    name: 'S&P 500 (mini)',
    pointValueMicros: 50_000_000,
    tickValueMicros: 12_500_000,
    tickSizeMicros: 250_000,
  },
  {
    symbol: 'MES',
    name: 'Micro S&P 500',
    pointValueMicros: 5_000_000,
    tickValueMicros: 1_250_000,
    tickSizeMicros: 250_000,
  },
]

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function assertInstrumentSpec(spec) {
  const valid =
    BigInt(spec.pointValueMicros) * BigInt(spec.tickSizeMicros) ===
    BigInt(spec.tickValueMicros) * 1_000_000n
  if (!valid) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      'Point value must equal tick value divided by tick size.',
    )
  }
}

async function assertUnique(Model, filter, message) {
  if (await Model.exists(filter)) duplicate(message)
}

function notFound() {
  throw new HttpError(404, 'NOT_FOUND', 'The requested record was not found.')
}

function versionConflict() {
  throw new HttpError(409, 'VERSION_CONFLICT', 'This record changed. Reload and try again.')
}

function duplicate(message) {
  throw new HttpError(409, 'CONFLICT', message)
}

function handleWriteError(error, duplicateMessage) {
  if (error?.code === 11000) duplicate(duplicateMessage)
  throw error
}

/** Idempotently creates only the explicitly approved default reference data. */
export async function ensureReferenceData(userId) {
  if ((await Instrument.countDocuments({ userId })) === 0) {
    await Promise.all(
      BUILT_IN_INSTRUMENTS.map((instrument) =>
        Instrument.updateOne(
          { userId, symbol: instrument.symbol },
          { $setOnInsert: { ...instrument, active: true, builtIn: true } },
          { upsert: true },
        ),
      ),
    )
  }

  if ((await TradingAccount.countDocuments({ userId })) === 0) {
    await TradingAccount.updateOne(
      { userId, name: 'Main Account' },
      {
        $setOnInsert: {
          broker: '',
          accountType: 'live',
          startingBalanceMicros: 0,
          isDefault: true,
          archivedAt: null,
        },
      },
      { upsert: true },
    )
  }
}

function serializeInstrument(document) {
  return {
    id: document._id.toString(),
    symbol: document.symbol,
    name: document.name,
    pointValueMicros: document.pointValueMicros,
    tickValueMicros: document.tickValueMicros,
    tickSizeMicros: document.tickSizeMicros,
    active: document.active,
    builtIn: document.builtIn,
    version: document.version,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  }
}

function serializeAccount(document) {
  return {
    id: document._id.toString(),
    name: document.name,
    broker: document.broker,
    accountType: document.accountType,
    startingBalanceMicros: document.startingBalanceMicros,
    startingBalance: microsToDollars(document.startingBalanceMicros),
    isDefault: document.isDefault,
    archivedAt: document.archivedAt,
    version: document.version,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  }
}

function serializeTag(document) {
  return {
    id: document._id.toString(),
    type: document.type,
    name: document.name,
    slug: document.slug,
    color: document.color,
    builtIn: document.builtIn,
    archivedAt: document.archivedAt,
    version: document.version,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  }
}

function serializeTradingSession(document) {
  return {
    id: document._id.toString(),
    name: document.name,
    slug: document.slug,
    color: document.color,
    displayOrder: document.displayOrder,
    archivedAt: document.archivedAt,
    version: document.version,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  }
}

function serializeChecklistItem(document) {
  return {
    id: document._id.toString(),
    text: document.text,
    sortOrder: document.sortOrder,
    archivedAt: document.archivedAt,
    version: document.version,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  }
}

export async function listReferenceData(userId, includeArchived = false) {
  await ensureReferenceData(userId)

  const dateFilter = includeArchived ? {} : { archivedAt: null }
  const instrumentFilter = includeArchived ? {} : { active: true }

  const [instruments, accounts, tags, sessions, checklist] = await Promise.all([
    Instrument.find({ userId, ...instrumentFilter }).sort({ symbol: 1 }),
    TradingAccount.find({ userId, ...dateFilter }).sort({ isDefault: -1, name: 1 }),
    Tag.find({ userId, ...dateFilter }).sort({ type: 1, name: 1 }),
    TradingSession.find({ userId, ...dateFilter }).sort({ displayOrder: 1, name: 1 }),
    ChecklistItem.find({ userId, ...dateFilter }).sort({ sortOrder: 1, createdAt: 1 }),
  ])

  return {
    instruments: instruments.map(serializeInstrument),
    accounts: accounts.map(serializeAccount),
    tags: tags.map(serializeTag),
    tradingSessions: sessions.map(serializeTradingSession),
    checklist: checklist.map(serializeChecklistItem),
  }
}

async function createOwned(Model, userId, payload, duplicateMessage, serializer) {
  try {
    const document = await Model.create({ ...payload, userId })
    return serializer(document)
  } catch (error) {
    handleWriteError(error, duplicateMessage)
  }
}

async function updateOwned(
  Model,
  userId,
  id,
  expectedVersion,
  patch,
  duplicateMessage,
  serializer,
) {
  const result = await Model.updateOne(
    { _id: id, userId, version: expectedVersion },
    { $set: { ...patch, version: expectedVersion + 1 } },
  )

  if (result.matchedCount === 0) {
    if (!(await Model.exists({ _id: id, userId }))) notFound()
    versionConflict()
  }

  const document = await Model.findOne({ _id: id, userId })
  if (!document) notFound()
  return serializer(document)
}

async function setArchived(Model, userId, id, archivedAt, serializer) {
  const document = await Model.findOne({ _id: id, userId })
  if (!document) notFound()

  const patch = Model.modelName === 'Instrument' ? { active: archivedAt === null } : { archivedAt }

  try {
    const result = await Model.updateOne(
      { _id: id, userId, version: document.version },
      { $set: { ...patch, version: document.version + 1 } },
    )
    if (result.matchedCount === 0) versionConflict()
  } catch (error) {
    handleWriteError(error, 'A conflicting record already exists.')
  }

  const updated = await Model.findOne({ _id: id, userId })
  return serializer(updated)
}

export async function createInstrument(userId, payload) {
  assertInstrumentSpec(payload)
  await assertUnique(
    Instrument,
    { userId, symbol: payload.symbol },
    'An instrument with that symbol already exists.',
  )
  return createOwned(
    Instrument,
    userId,
    payload,
    'An instrument with that symbol already exists.',
    serializeInstrument,
  )
}

export async function updateInstrument(userId, id, payload) {
  const { expectedVersion, ...patch } = payload
  const existing = await Instrument.findOne({ _id: id, userId })
  if (!existing) notFound()
  assertInstrumentSpec({ ...existing.toObject(), ...patch })
  await assertUnique(
    Instrument,
    { userId, symbol: patch.symbol ?? existing.symbol, _id: { $ne: existing._id } },
    'An instrument with that symbol already exists.',
  )

  return updateOwned(
    Instrument,
    userId,
    id,
    expectedVersion,
    patch,
    'An instrument with that symbol already exists.',
    serializeInstrument,
  )
}

export function archiveInstrument(userId, id) {
  return setArchived(Instrument, userId, id, new Date(), serializeInstrument)
}

export function restoreInstrument(userId, id) {
  return setArchived(Instrument, userId, id, null, serializeInstrument)
}

export async function createAccount(userId, payload) {
  await ensureReferenceData(userId)

  const startingBalanceMicros = dollarsToMicros(payload.startingBalance)
  const shouldBeDefault =
    payload.isDefault || (await TradingAccount.countDocuments({ userId, archivedAt: null })) === 0

  if (shouldBeDefault) {
    await TradingAccount.updateMany(
      { userId, isDefault: true },
      { $set: { isDefault: false }, $inc: { version: 1 } },
    )
  }

  return createOwned(
    TradingAccount,
    userId,
    {
      name: payload.name,
      broker: payload.broker,
      accountType: payload.accountType,
      startingBalanceMicros,
      isDefault: shouldBeDefault,
      archivedAt: null,
    },
    'An account with that name already exists.',
    serializeAccount,
  )
}

export function updateAccount(userId, id, payload) {
  const { expectedVersion, startingBalance, ...rest } = payload
  const patch = { ...rest }
  if (startingBalance !== undefined) patch.startingBalanceMicros = dollarsToMicros(startingBalance)

  return updateOwned(
    TradingAccount,
    userId,
    id,
    expectedVersion,
    patch,
    'An account with that name already exists.',
    serializeAccount,
  )
}

export async function archiveAccount(userId, id) {
  const account = await TradingAccount.findOne({ _id: id, userId })
  if (!account) notFound()
  if (account.isDefault && account.archivedAt === null) {
    throw new HttpError(409, 'DEFAULT_ACCOUNT', 'Set another account as default before archiving.')
  }
  return setArchived(TradingAccount, userId, id, new Date(), serializeAccount)
}

export function restoreAccount(userId, id) {
  return setArchived(TradingAccount, userId, id, null, serializeAccount)
}

export async function setDefaultAccount(userId, id) {
  const account = await TradingAccount.findOne({ _id: id, userId, archivedAt: null })
  if (!account) notFound()

  await TradingAccount.updateMany(
    { userId, isDefault: true, _id: { $ne: account._id } },
    { $set: { isDefault: false }, $inc: { version: 1 } },
  )

  const result = await TradingAccount.updateOne(
    { _id: account._id, userId, version: account.version },
    { $set: { isDefault: true }, $inc: { version: 1 } },
  )
  if (result.matchedCount === 0) versionConflict()

  return serializeAccount(await TradingAccount.findOne({ _id: account._id, userId }))
}

export async function createTag(userId, payload) {
  await assertUnique(
    Tag,
    { userId, type: payload.type, slug: slugify(payload.name) },
    'A tag with that name already exists.',
  )
  return createOwned(
    Tag,
    userId,
    { ...payload, slug: slugify(payload.name), builtIn: false, archivedAt: null },
    'A tag with that name already exists.',
    serializeTag,
  )
}

export async function updateTag(userId, id, payload) {
  const { expectedVersion, name, ...rest } = payload
  const patch = { ...rest }
  if (name !== undefined) {
    patch.name = name
    patch.slug = slugify(name)
  }

  const existing = await Tag.findOne({ _id: id, userId })
  if (!existing) notFound()
  await assertUnique(
    Tag,
    {
      userId,
      type: patch.type ?? existing.type,
      slug: patch.slug ?? existing.slug,
      _id: { $ne: existing._id },
    },
    'A tag with that name already exists.',
  )

  return updateOwned(
    Tag,
    userId,
    id,
    expectedVersion,
    patch,
    'A tag with that name already exists.',
    serializeTag,
  )
}

export function archiveTag(userId, id) {
  return setArchived(Tag, userId, id, new Date(), serializeTag)
}

export function restoreTag(userId, id) {
  return setArchived(Tag, userId, id, null, serializeTag)
}

export async function createTradingSession(userId, payload) {
  await assertUnique(
    TradingSession,
    { userId, slug: slugify(payload.name) },
    'A trading session with that name already exists.',
  )
  return createOwned(
    TradingSession,
    userId,
    { ...payload, slug: slugify(payload.name), archivedAt: null },
    'A trading session with that name already exists.',
    serializeTradingSession,
  )
}

export async function updateTradingSession(userId, id, payload) {
  const { expectedVersion, name, ...rest } = payload
  const patch = { ...rest }
  if (name !== undefined) {
    patch.name = name
    patch.slug = slugify(name)
  }

  const existing = await TradingSession.findOne({ _id: id, userId })
  if (!existing) notFound()
  await assertUnique(
    TradingSession,
    { userId, slug: patch.slug ?? existing.slug, _id: { $ne: existing._id } },
    'A trading session with that name already exists.',
  )

  return updateOwned(
    TradingSession,
    userId,
    id,
    expectedVersion,
    patch,
    'A trading session with that name already exists.',
    serializeTradingSession,
  )
}

export function archiveTradingSession(userId, id) {
  return setArchived(TradingSession, userId, id, new Date(), serializeTradingSession)
}

export function restoreTradingSession(userId, id) {
  return setArchived(TradingSession, userId, id, null, serializeTradingSession)
}

export function createChecklistItem(userId, payload) {
  return createOwned(
    ChecklistItem,
    userId,
    { ...payload, archivedAt: null },
    'A checklist item with that text already exists.',
    serializeChecklistItem,
  )
}

export function updateChecklistItem(userId, id, payload) {
  const { expectedVersion, ...patch } = payload
  return updateOwned(
    ChecklistItem,
    userId,
    id,
    expectedVersion,
    patch,
    'A checklist item with that text already exists.',
    serializeChecklistItem,
  )
}

export function archiveChecklistItem(userId, id) {
  return setArchived(ChecklistItem, userId, id, new Date(), serializeChecklistItem)
}

export function restoreChecklistItem(userId, id) {
  return setArchived(ChecklistItem, userId, id, null, serializeChecklistItem)
}
