import { Router } from 'express'
import multer from 'multer'
import { uploadsDirFor } from '../config.js'
import { HttpError, parse } from '../lib/http-error.js'
import { todayInTimeZone } from '../lib/timezone.js'
import { requireAuth } from '../middleware/auth.js'
import { FileRecord } from '../models/file.js'
import { LearningRecord } from '../models/learning-record.js'
import {
  learningCategoryCreateSchema,
  learningCategoryPatchSchema,
  learningGoalCreateSchema,
  learningGoalPatchSchema,
  learningGoalQuerySchema,
  learningRecordCreateSchema,
  learningRecordPatchSchema,
  learningRecordQuerySchema,
  learningSummaryQuerySchema,
  milestoneCreateSchema,
  milestonePatchSchema,
  taskCreateSchema,
  taskPatchSchema,
  expectedVersionSchema,
} from '../../shared/validation/learning.js'
import { includeArchivedSchema, objectIdSchema } from '../../shared/validation/reference.js'
import { ALLOWED_IMAGE_MIMES, createLearningAttachments } from '../services/file-service.js'
import {
  addMilestone,
  addTask,
  archiveLearningCategory,
  createLearningCategory,
  createLearningGoal,
  createLearningRecord,
  deleteLearningGoal,
  deleteLearningRecord,
  deleteMilestone,
  deleteTask,
  getLearningGoal,
  getLearningRecord,
  getLearningSummary,
  listLearningCategories,
  listLearningGoals,
  listLearningRecords,
  restoreLearningCategory,
  restoreLearningGoal,
  restoreLearningRecord,
  updateLearningCategory,
  updateLearningGoal,
  updateLearningRecord,
  updateMilestone,
  updateTask,
} from '../services/learning-service.js'
import { getOrCreateSettings } from '../services/settings-service.js'

export const learningRouter = Router()

function recordId(req) {
  return parse(objectIdSchema, req.params.id)
}

function nestedId(req, name) {
  return parse(objectIdSchema, req.params[name])
}

function respond(res, payload, status = 200) {
  res.status(status)
  res.setHeader('Cache-Control', 'no-store')
  res.json({ data: payload })
}

function attachmentUpload(req, res, next) {
  const config = req.app.locals.config
  const limit = config.maxLearningAttachments ?? 5
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: config.maxLearningAttachmentBytes ?? config.maxScreenshotBytes ?? 10 * 1024 * 1024,
      files: limit,
      fields: 0,
      parts: limit,
    },
    fileFilter(_req, file, callback) {
      if (!ALLOWED_IMAGE_MIMES.includes(file.mimetype)) {
        callback(new Error('Only JPEG, PNG, and WebP attachments are allowed.'))
        return
      }
      callback(null, true)
    },
  }).array('attachments', limit)

  upload(req, res, (error) => {
    if (error) {
      next(new HttpError(400, 'FILE_INVALID', error.message))
      return
    }
    next()
  })
}

learningRouter.get('/learning/categories', requireAuth, async (req, res) => {
  const includeArchived = parse(includeArchivedSchema, req.query.includeArchived)
  respond(res, {
    categories: await listLearningCategories(req.user._id, includeArchived),
  })
})

learningRouter.post('/learning/categories', requireAuth, async (req, res) => {
  const payload = parse(learningCategoryCreateSchema, req.body ?? {})
  respond(res, { category: await createLearningCategory(req.user._id, payload) }, 201)
})

learningRouter.patch('/learning/categories/:id', requireAuth, async (req, res) => {
  const payload = parse(learningCategoryPatchSchema, req.body ?? {})
  respond(res, {
    category: await updateLearningCategory(req.user._id, recordId(req), payload),
  })
})

learningRouter.post('/learning/categories/:id/archive', requireAuth, async (req, res) => {
  respond(res, {
    category: await archiveLearningCategory(req.user._id, recordId(req)),
  })
})

learningRouter.post('/learning/categories/:id/restore', requireAuth, async (req, res) => {
  respond(res, {
    category: await restoreLearningCategory(req.user._id, recordId(req)),
  })
})

learningRouter.get('/learning/records', requireAuth, async (req, res) => {
  const query = parse(learningRecordQuerySchema, req.query ?? {})
  respond(res, { records: await listLearningRecords(req.user._id, query) })
})

learningRouter.post('/learning/records', requireAuth, async (req, res) => {
  const payload = parse(learningRecordCreateSchema, req.body ?? {})
  respond(res, { record: await createLearningRecord(req.user._id, payload) }, 201)
})

learningRouter.get('/learning/records/:id', requireAuth, async (req, res) => {
  respond(res, { record: await getLearningRecord(req.user._id, recordId(req)) })
})

learningRouter.patch('/learning/records/:id', requireAuth, async (req, res) => {
  const payload = parse(learningRecordPatchSchema, req.body ?? {})
  respond(res, {
    record: await updateLearningRecord(req.user._id, recordId(req), payload),
  })
})

learningRouter.delete('/learning/records/:id', requireAuth, async (req, res) => {
  const { expectedVersion } = parse(expectedVersionSchema, req.body ?? {})
  respond(res, {
    record: await deleteLearningRecord(req.user._id, recordId(req), expectedVersion),
  })
})

learningRouter.post('/learning/records/:id/restore', requireAuth, async (req, res) => {
  const { expectedVersion } = parse(expectedVersionSchema, req.body ?? {})
  respond(res, {
    record: await restoreLearningRecord(req.user._id, recordId(req), expectedVersion),
  })
})

learningRouter.post(
  '/learning/records/:id/attachments',
  requireAuth,
  attachmentUpload,
  async (req, res) => {
    const id = recordId(req)
    const exists = await LearningRecord.exists({
      _id: id,
      userId: req.user._id,
      deletedAt: null,
    })
    if (!exists)
      throw new HttpError(404, 'NOT_FOUND', 'The requested learning record was not found.')

    const config = req.app.locals.config
    const limit = config.maxLearningAttachments ?? 5
    const currentCount = await FileRecord.countDocuments({
      userId: req.user._id,
      ownerType: 'LearningRecord',
      ownerId: id,
      deletedAt: null,
    })
    if (currentCount + (req.files?.length ?? 0) > limit) {
      throw new HttpError(
        400,
        'FILE_LIMIT',
        `A learning record can have at most ${limit} attachments.`,
      )
    }

    const attachments = await createLearningAttachments({
      userId: req.user._id,
      recordId: id,
      files: req.files ?? [],
      uploadsDir: uploadsDirFor(config),
      maxBytes: config.maxLearningAttachmentBytes ?? config.maxScreenshotBytes ?? 10 * 1024 * 1024,
    })

    respond(res, { attachments }, 201)
  },
)

learningRouter.get('/learning/goals', requireAuth, async (req, res) => {
  const query = parse(learningGoalQuerySchema, req.query ?? {})
  respond(res, { goals: await listLearningGoals(req.user._id, query) })
})

learningRouter.post('/learning/goals', requireAuth, async (req, res) => {
  const payload = parse(learningGoalCreateSchema, req.body ?? {})
  respond(res, { goal: await createLearningGoal(req.user._id, payload) }, 201)
})

learningRouter.get('/learning/goals/:id', requireAuth, async (req, res) => {
  respond(res, { goal: await getLearningGoal(req.user._id, recordId(req)) })
})

learningRouter.patch('/learning/goals/:id', requireAuth, async (req, res) => {
  const payload = parse(learningGoalPatchSchema, req.body ?? {})
  respond(res, { goal: await updateLearningGoal(req.user._id, recordId(req), payload) })
})

learningRouter.delete('/learning/goals/:id', requireAuth, async (req, res) => {
  const { expectedVersion } = parse(expectedVersionSchema, req.body ?? {})
  respond(res, {
    goal: await deleteLearningGoal(req.user._id, recordId(req), expectedVersion),
  })
})

learningRouter.post('/learning/goals/:id/restore', requireAuth, async (req, res) => {
  const { expectedVersion } = parse(expectedVersionSchema, req.body ?? {})
  respond(res, {
    goal: await restoreLearningGoal(req.user._id, recordId(req), expectedVersion),
  })
})

learningRouter.post('/learning/goals/:id/milestones', requireAuth, async (req, res) => {
  const payload = parse(milestoneCreateSchema, req.body ?? {})
  respond(res, { goal: await addMilestone(req.user._id, recordId(req), payload) }, 201)
})

learningRouter.patch(
  '/learning/goals/:id/milestones/:milestoneId',
  requireAuth,
  async (req, res) => {
    const payload = parse(milestonePatchSchema, req.body ?? {})
    respond(res, {
      goal: await updateMilestone(
        req.user._id,
        recordId(req),
        nestedId(req, 'milestoneId'),
        payload,
      ),
    })
  },
)

learningRouter.delete(
  '/learning/goals/:id/milestones/:milestoneId',
  requireAuth,
  async (req, res) => {
    const { expectedVersion } = parse(expectedVersionSchema, req.body ?? {})
    respond(res, {
      goal: await deleteMilestone(
        req.user._id,
        recordId(req),
        nestedId(req, 'milestoneId'),
        expectedVersion,
      ),
    })
  },
)

learningRouter.post('/learning/goals/:id/tasks', requireAuth, async (req, res) => {
  const payload = parse(taskCreateSchema, req.body ?? {})
  respond(res, { goal: await addTask(req.user._id, recordId(req), payload) }, 201)
})

learningRouter.patch('/learning/goals/:id/tasks/:taskId', requireAuth, async (req, res) => {
  const payload = parse(taskPatchSchema, req.body ?? {})
  respond(res, {
    goal: await updateTask(req.user._id, recordId(req), nestedId(req, 'taskId'), payload),
  })
})

learningRouter.delete('/learning/goals/:id/tasks/:taskId', requireAuth, async (req, res) => {
  const { expectedVersion } = parse(expectedVersionSchema, req.body ?? {})
  respond(res, {
    goal: await deleteTask(req.user._id, recordId(req), nestedId(req, 'taskId'), expectedVersion),
  })
})

learningRouter.get('/learning/summary', requireAuth, async (req, res) => {
  const query = parse(learningSummaryQuerySchema, req.query ?? {})
  const settings = await getOrCreateSettings(req.user._id)
  const summary = await getLearningSummary(req.user._id, query, {
    dailyTargetMinutes: settings.dailyStudyTargetMinutes,
    today: todayInTimeZone(settings.appTimeZone),
  })
  respond(res, { summary })
})
