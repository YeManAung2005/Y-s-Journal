import { createHash, randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { FileRecord } from '../models/file.js'
import { HttpError } from '../lib/http-error.js'

const ALLOWED_TYPES = new Map([
  ['jpeg', { mimeType: 'image/jpeg', extension: 'jpg' }],
  ['png', { mimeType: 'image/png', extension: 'png' }],
  ['webp', { mimeType: 'image/webp', extension: 'webp' }],
])

export const ALLOWED_SCREENSHOT_MIMES = [
  ...new Set([...ALLOWED_TYPES.values()].map((v) => v.mimeType)),
]
export const ALLOWED_IMAGE_MIMES = ALLOWED_SCREENSHOT_MIMES

export const FILE_OWNER_TYPES = Object.freeze({
  trade: 'Trade',
  learningRecord: 'LearningRecord',
})

function safeOriginalName(value) {
  return (
    path
      .basename(String(value || 'screenshot'))
      .replace(/[^\w.\- ]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180) || 'screenshot'
  )
}

async function processScreenshot(file, maxBytes) {
  if (!file?.buffer || file.size === 0) {
    throw new HttpError(400, 'FILE_INVALID', 'Uploaded images must not be empty.')
  }
  if (file.size > maxBytes) {
    throw new HttpError(400, 'FILE_TOO_LARGE', 'Each screenshot must be 10 MB or smaller.')
  }
  if (!ALLOWED_SCREENSHOT_MIMES.includes(file.mimetype)) {
    throw new HttpError(400, 'FILE_INVALID', 'Only JPEG, PNG, and WebP screenshots are allowed.')
  }

  let image
  try {
    image = sharp(file.buffer, { failOn: 'error', limitInputPixels: 50_000_000 })
    const metadata = await image.metadata()
    const type = ALLOWED_TYPES.get(String(metadata.format).toLowerCase())

    if (!type || type.mimeType !== file.mimetype) {
      throw new HttpError(
        400,
        'FILE_INVALID',
        'The file contents do not match an allowed JPEG, PNG, or WebP image.',
      )
    }

    let pipeline = image.rotate()
    if (type.extension === 'jpg') pipeline = pipeline.jpeg({ quality: 88, mozjpeg: true })
    else if (type.extension === 'png') pipeline = pipeline.png({ compressionLevel: 9 })
    else pipeline = pipeline.webp({ quality: 88 })

    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true })

    if (data.length > maxBytes) {
      throw new HttpError(400, 'FILE_TOO_LARGE', 'The processed screenshot exceeds the size limit.')
    }

    return {
      buffer: data,
      mimeType: type.mimeType,
      extension: type.extension,
      width: info.width,
      height: info.height,
      sizeBytes: data.length,
      sha256: createHash('sha256').update(data).digest('hex'),
      originalName: safeOriginalName(file.originalname),
    }
  } catch (error) {
    if (error instanceof HttpError) throw error
    throw new HttpError(400, 'FILE_INVALID', 'The screenshot could not be read as a valid image.')
  }
}

export function serializeFile(document) {
  return {
    id: document._id.toString(),
    ownerType: document.ownerType,
    ownerId: document.ownerId.toString(),
    originalName: document.originalName,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    sha256: document.sha256,
    width: document.width,
    height: document.height,
    label: document.label,
    url: `/api/v1/files/${document._id.toString()}`,
    deletedAt: document.deletedAt,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  }
}

export function resolveStoredPath(storageKey, uploadsDir) {
  const root = path.resolve(uploadsDir)
  const target = path.resolve(root, storageKey)

  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new HttpError(400, 'FILE_INVALID', 'Invalid storage key.')
  }

  return target
}

export async function listOwnerFiles(userId, ownerType, ownerId) {
  const files = await FileRecord.find({
    userId,
    ownerType,
    ownerId,
    deletedAt: null,
  }).sort({ createdAt: 1, _id: 1 })

  return files.map(serializeFile)
}

export async function createOwnerImages({
  userId,
  ownerType,
  ownerId,
  files,
  uploadsDir,
  maxBytes,
  requiredMessage = 'Choose at least one image.',
}) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new HttpError(400, 'FILE_REQUIRED', requiredMessage)
  }

  const processed = []
  for (const file of files) {
    processed.push(await processScreenshot(file, maxBytes))
  }

  const createdPaths = []
  try {
    const records = []
    for (const item of processed) {
      const now = new Date()
      const storageKey = path.join(
        userId.toString(),
        String(now.getUTCFullYear()),
        String(now.getUTCMonth() + 1).padStart(2, '0'),
        `${randomUUID()}.${item.extension}`,
      )
      const target = resolveStoredPath(storageKey, uploadsDir)
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, item.buffer, { flag: 'wx' })
      createdPaths.push(target)

      const record = await FileRecord.create({
        userId,
        ownerType,
        ownerId,
        originalName: item.originalName,
        storageKey,
        mimeType: item.mimeType,
        sizeBytes: item.sizeBytes,
        sha256: item.sha256,
        width: item.width,
        height: item.height,
        label: '',
      })
      records.push(record)
    }

    return records.map(serializeFile)
  } catch (error) {
    await Promise.all(createdPaths.map((filePath) => unlink(filePath).catch(() => undefined)))
    throw error
  }
}

export function listTradeScreenshots(userId, tradeId) {
  return listOwnerFiles(userId, FILE_OWNER_TYPES.trade, tradeId)
}

export function createTradeScreenshots(options) {
  return createOwnerImages({
    ...options,
    ownerType: FILE_OWNER_TYPES.trade,
    ownerId: options.tradeId,
    requiredMessage: 'Choose at least one screenshot.',
  })
}

export function listLearningAttachments(userId, recordId) {
  return listOwnerFiles(userId, FILE_OWNER_TYPES.learningRecord, recordId)
}

export function createLearningAttachments(options) {
  return createOwnerImages({
    ...options,
    ownerType: FILE_OWNER_TYPES.learningRecord,
    ownerId: options.recordId,
    requiredMessage: 'Choose at least one attachment.',
  })
}

export async function getOwnedFile(userId, fileId) {
  const file = await FileRecord.findOne({ _id: fileId, userId, deletedAt: null })
  if (!file) throw new HttpError(404, 'NOT_FOUND', 'The requested file was not found.')
  return file
}

export async function softDeleteFile(userId, fileId) {
  const file = await FileRecord.findOneAndUpdate(
    { _id: fileId, userId, deletedAt: null },
    { $set: { deletedAt: new Date(), deletedBy: userId, deletedReason: 'manual' } },
    { returnDocument: 'after' },
  )
  if (!file) throw new HttpError(404, 'NOT_FOUND', 'The requested file was not found.')
  return serializeFile(file)
}

export function markOwnerFilesDeleted(userId, ownerType, ownerId, deletedBy, deletedReason) {
  return FileRecord.updateMany(
    { userId, ownerType, ownerId, deletedAt: null },
    { $set: { deletedAt: new Date(), deletedBy, deletedReason } },
  )
}

export function restoreOwnerFiles(userId, ownerType, ownerId, deletedReason) {
  return FileRecord.updateMany(
    { userId, ownerType, ownerId, deletedReason },
    { $set: { deletedAt: null, deletedBy: null, deletedReason: null } },
  )
}

export function markTradeFilesDeleted(userId, tradeId, deletedBy) {
  return markOwnerFilesDeleted(userId, FILE_OWNER_TYPES.trade, tradeId, deletedBy, 'trade_deleted')
}

export function restoreTradeFiles(userId, tradeId) {
  return restoreOwnerFiles(userId, FILE_OWNER_TYPES.trade, tradeId, 'trade_deleted')
}

export function markLearningFilesDeleted(userId, recordId, deletedBy) {
  return markOwnerFilesDeleted(
    userId,
    FILE_OWNER_TYPES.learningRecord,
    recordId,
    deletedBy,
    'learning_record_deleted',
  )
}

export function restoreLearningFiles(userId, recordId) {
  return restoreOwnerFiles(
    userId,
    FILE_OWNER_TYPES.learningRecord,
    recordId,
    'learning_record_deleted',
  )
}
