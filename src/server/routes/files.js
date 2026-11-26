import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { Router } from 'express'
import { uploadsDirFor } from '../config.js'
import { HttpError, parse } from '../lib/http-error.js'
import { requireAuth } from '../middleware/auth.js'
import { FileRecord } from '../models/file.js'
import { recordSecurityEvent } from '../services/security-service.js'
import { resolveStoredPath, softDeleteFile } from '../services/file-service.js'
import { objectIdSchema } from '../../shared/validation/reference.js'

export const filesRouter = Router()

function safeFileName(name) {
  return path
    .basename(String(name || 'screenshot'))
    .replace(/[^\w.\- ]/g, '_')
    .slice(0, 180)
}

function deny(req, fileId) {
  return recordSecurityEvent({
    type: 'access_denied',
    userId: req.user._id,
    req,
    logger: req.log,
    metadata: { resource: 'file', fileId },
  })
}

filesRouter.get('/files/:id', requireAuth, async (req, res) => {
  const fileId = parse(objectIdSchema, req.params.id)
  const file = await FileRecord.findOne({ _id: fileId, deletedAt: null })

  if (!file || file.userId.toString() !== req.user._id.toString()) {
    await deny(req, fileId)
    throw new HttpError(404, 'NOT_FOUND', 'The requested file was not found.')
  }

  const target = resolveStoredPath(file.storageKey, uploadsDirFor(req.app.locals.config))
  let info
  try {
    info = await stat(target)
    if (!info.isFile()) throw new Error('Not a file')
  } catch {
    throw new HttpError(404, 'NOT_FOUND', 'The requested file was not found.')
  }

  res.status(200)
  res.setHeader('Content-Type', file.mimeType)
  res.setHeader('Content-Length', String(info.size))
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Content-Disposition', `inline; filename="${safeFileName(file.originalName)}"`)

  const stream = createReadStream(target)
  stream.on('error', () => {
    if (!res.headersSent) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'The requested file was not found.',
          requestId: req.id,
        },
      })
    } else {
      res.destroy()
    }
  })
  stream.pipe(res)
})

filesRouter.delete('/files/:id', requireAuth, async (req, res) => {
  const fileId = parse(objectIdSchema, req.params.id)
  const file = await FileRecord.findOne({ _id: fileId, deletedAt: null })

  if (!file || file.userId.toString() !== req.user._id.toString()) {
    await deny(req, fileId)
    throw new HttpError(404, 'NOT_FOUND', 'The requested file was not found.')
  }

  res.setHeader('Cache-Control', 'no-store')
  res.json({ data: { file: await softDeleteFile(req.user._id, fileId) } })
})
