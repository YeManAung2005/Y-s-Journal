import { Router } from 'express'
import multer from 'multer'
import { uploadsDirFor } from '../config.js'
import { HttpError, parse } from '../lib/http-error.js'
import { requireAuth } from '../middleware/auth.js'
import { FileRecord } from '../models/file.js'
import { Trade } from '../models/trade.js'
import {
  expectedVersionSchema,
  tradeCreateSchema,
  tradeListQuerySchema,
  tradePatchSchema,
} from '../../shared/validation/trade.js'
import { objectIdSchema } from '../../shared/validation/reference.js'
import { ALLOWED_SCREENSHOT_MIMES, createTradeScreenshots } from '../services/file-service.js'
import {
  createTrade,
  deleteTrade,
  getTrade,
  listTrades,
  restoreTrade,
  updateTrade,
} from '../services/trade-service.js'

export const tradesRouter = Router()

function recordId(req) {
  return parse(objectIdSchema, req.params.id)
}

function respond(res, payload, status = 200) {
  res.status(status)
  res.setHeader('Cache-Control', 'no-store')
  res.json({ data: payload })
}

function screenshotUpload(req, res, next) {
  const config = req.app.locals.config
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: config.maxScreenshotBytes ?? 10 * 1024 * 1024,
      files: config.maxScreenshotsPerTrade ?? 5,
      fields: 0,
      parts: config.maxScreenshotsPerTrade ?? 5,
    },
    fileFilter(_req, file, callback) {
      if (!ALLOWED_SCREENSHOT_MIMES.includes(file.mimetype)) {
        callback(new Error('Only JPEG, PNG, and WebP screenshots are allowed.'))
        return
      }
      callback(null, true)
    },
  }).array('screenshots', config.maxScreenshotsPerTrade ?? 5)

  upload(req, res, (error) => {
    if (error) {
      next(new HttpError(400, 'FILE_INVALID', error.message))
      return
    }
    next()
  })
}

tradesRouter.get('/trades', requireAuth, async (req, res) => {
  const query = parse(tradeListQuerySchema, req.query ?? {})
  respond(res, { trades: await listTrades(req.user._id, query) })
})

tradesRouter.post('/trades', requireAuth, async (req, res) => {
  const payload = parse(tradeCreateSchema, req.body ?? {})
  respond(res, { trade: await createTrade(req.user._id, payload) }, 201)
})

tradesRouter.get('/trades/:id', requireAuth, async (req, res) => {
  respond(res, { trade: await getTrade(req.user._id, recordId(req)) })
})

tradesRouter.patch('/trades/:id', requireAuth, async (req, res) => {
  const payload = parse(tradePatchSchema, req.body ?? {})
  respond(res, { trade: await updateTrade(req.user._id, recordId(req), payload) })
})

tradesRouter.delete('/trades/:id', requireAuth, async (req, res) => {
  const { expectedVersion } = parse(expectedVersionSchema, req.body ?? {})
  respond(res, { trade: await deleteTrade(req.user._id, recordId(req), expectedVersion) })
})

tradesRouter.post('/trades/:id/restore', requireAuth, async (req, res) => {
  const { expectedVersion } = parse(expectedVersionSchema, req.body ?? {})
  respond(res, { trade: await restoreTrade(req.user._id, recordId(req), expectedVersion) })
})

tradesRouter.post('/trades/:id/screenshots', requireAuth, screenshotUpload, async (req, res) => {
  const tradeId = recordId(req)
  const exists = await Trade.exists({ _id: tradeId, userId: req.user._id, deletedAt: null })
  if (!exists) throw new HttpError(404, 'NOT_FOUND', 'The requested trade was not found.')

  const config = req.app.locals.config
  const limit = config.maxScreenshotsPerTrade ?? 5
  const currentCount = await FileRecord.countDocuments({
    userId: req.user._id,
    ownerType: 'Trade',
    ownerId: tradeId,
    deletedAt: null,
  })
  if (currentCount + (req.files?.length ?? 0) > limit) {
    throw new HttpError(400, 'FILE_LIMIT', `A trade can have at most ${limit} screenshots.`)
  }

  const files = await createTradeScreenshots({
    userId: req.user._id,
    tradeId,
    files: req.files ?? [],
    uploadsDir: uploadsDirFor(req.app.locals.config),
    maxBytes: req.app.locals.config.maxScreenshotBytes ?? 10 * 1024 * 1024,
  })

  respond(res, { files }, 201)
})
