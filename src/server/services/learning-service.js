import mongoose from 'mongoose'
import { summarizeLearning } from '../../shared/learning/streaks.js'
import { HttpError } from '../lib/http-error.js'
import { LearningCategory } from '../models/learning-category.js'
import { LearningGoal } from '../models/learning-goal.js'
import { LearningRecord } from '../models/learning-record.js'
import {
  listLearningAttachments,
  markLearningFilesDeleted,
  restoreLearningFiles,
} from './file-service.js'

function notFound(message = 'The requested learning record was not found.') {
  throw new HttpError(404, 'NOT_FOUND', message)
}

function versionConflict() {
  throw new HttpError(409, 'VERSION_CONFLICT', 'This record changed. Reload and try again.')
}

function invalid(message) {
  throw new HttpError(400, 'VALIDATION_ERROR', message)
}

function duplicate(message) {
  throw new HttpError(409, 'CONFLICT', message)
}

function handleWriteError(error, duplicateMessage) {
  if (error?.code === 11000) duplicate(duplicateMessage)
  throw error
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function categorySnapshot(category) {
  return {
    id: category._id,
    name: category.name,
    slug: category.slug,
    color: category.color,
  }
}

function serializeCategory(document) {
  return {
    id: document._id.toString(),
    name: document.name,
    slug: document.slug,
    color: document.color,
    archivedAt: document.archivedAt,
    version: document.version,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  }
}

function serializeCategorySnapshot(snapshot) {
  if (!snapshot) return null
  return {
    id: snapshot.id.toString(),
    name: snapshot.name,
    slug: snapshot.slug,
    color: snapshot.color,
  }
}

export async function serializeLearningRecord(record) {
  const attachments = await listLearningAttachments(record.userId, record._id)

  return {
    id: record._id.toString(),
    date: record.date,
    categoryId: record.categoryId.toString(),
    categorySnapshot: serializeCategorySnapshot(record.categorySnapshot),
    goalId: record.goalId?.toString() ?? null,
    topic: record.topic,
    keyTakeaways: record.keyTakeaways,
    durationMinutes: record.durationMinutes,
    notes: record.notes,
    resources: record.resources.map((resource) => ({
      label: resource.label,
      url: resource.url,
    })),
    attachments,
    version: record.version,
    deletedAt: record.deletedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

function serializeMilestone(milestone) {
  return {
    id: milestone._id.toString(),
    title: milestone.title,
    dueDate: milestone.dueDate,
    completed: Boolean(milestone.completedAt),
    completedAt: milestone.completedAt,
  }
}

function serializeTask(task) {
  return {
    id: task._id.toString(),
    title: task.title,
    completed: Boolean(task.completedAt),
    completedAt: task.completedAt,
  }
}

export function computeGoalProgress(milestones, tasks) {
  const total = milestones.length + tasks.length
  if (total === 0) return 0
  const completed =
    milestones.filter((milestone) => milestone.completedAt).length +
    tasks.filter((task) => task.completedAt).length
  return Math.round((completed / total) * 100)
}

function serializeGoal(goal) {
  const milestones = goal.milestones.map(serializeMilestone)
  const tasks = goal.tasks.map(serializeTask)

  return {
    id: goal._id.toString(),
    title: goal.title,
    description: goal.description,
    categoryId: goal.categoryId?.toString() ?? null,
    categorySnapshot: serializeCategorySnapshot(goal.categorySnapshot),
    targetDate: goal.targetDate,
    status: goal.status,
    progressPercent: goal.progressPercent,
    milestones,
    tasks,
    completedMilestoneCount: milestones.filter((milestone) => milestone.completed).length,
    completedTaskCount: tasks.filter((task) => task.completed).length,
    completedAt: goal.completedAt,
    version: goal.version,
    deletedAt: goal.deletedAt,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
  }
}

async function assertCategoryUnique(userId, slug, excludeId = null) {
  const filter = { userId, slug }
  if (excludeId) filter._id = { $ne: excludeId }
  if (await LearningCategory.exists(filter)) {
    duplicate('A learning category with that name already exists.')
  }
}

async function activeCategory(userId, categoryId) {
  const category = await LearningCategory.findOne({
    _id: categoryId,
    userId,
    archivedAt: null,
  })
  if (!category) invalid('Choose an active learning category.')
  return category
}

async function activeGoal(userId, goalId) {
  const goal = await LearningGoal.findOne({ _id: goalId, userId, deletedAt: null })
  if (!goal) invalid('Choose an available learning goal.')
  return goal
}

export async function listLearningCategories(userId, includeArchived = false) {
  const filter = { userId }
  if (!includeArchived) filter.archivedAt = null
  const categories = await LearningCategory.find(filter).sort({ name: 1, createdAt: 1 })
  return categories.map(serializeCategory)
}

export async function createLearningCategory(userId, payload) {
  const slug = slugify(payload.name)
  await assertCategoryUnique(userId, slug)

  try {
    const category = await LearningCategory.create({
      userId,
      name: payload.name,
      slug,
      color: payload.color,
      archivedAt: null,
    })
    return serializeCategory(category)
  } catch (error) {
    handleWriteError(error, 'A learning category with that name already exists.')
  }
}

export async function updateLearningCategory(userId, categoryId, payload) {
  const { expectedVersion, ...patch } = payload
  const existing = await LearningCategory.findOne({ _id: categoryId, userId })
  if (!existing) notFound('The requested learning category was not found.')

  if (patch.name !== undefined) patch.slug = slugify(patch.name)
  await assertCategoryUnique(userId, patch.slug ?? existing.slug, existing._id)

  try {
    const result = await LearningCategory.updateOne(
      { _id: categoryId, userId, version: expectedVersion },
      { $set: { ...patch, version: expectedVersion + 1 } },
    )
    if (result.matchedCount === 0) versionConflict()
  } catch (error) {
    handleWriteError(error, 'A learning category with that name already exists.')
  }

  const updated = await LearningCategory.findOne({ _id: categoryId, userId })
  if (!updated) notFound('The requested learning category was not found.')
  return serializeCategory(updated)
}

async function setCategoryArchived(userId, categoryId, archivedAt) {
  const category = await LearningCategory.findOne({ _id: categoryId, userId })
  if (!category) notFound('The requested learning category was not found.')

  const result = await LearningCategory.updateOne(
    { _id: categoryId, userId, version: category.version },
    {
      $set: {
        archivedAt,
        version: category.version + 1,
      },
    },
  )
  if (result.matchedCount === 0) versionConflict()

  const updated = await LearningCategory.findOne({ _id: categoryId, userId })
  return serializeCategory(updated)
}

export function archiveLearningCategory(userId, categoryId) {
  return setCategoryArchived(userId, categoryId, new Date())
}

export function restoreLearningCategory(userId, categoryId) {
  return setCategoryArchived(userId, categoryId, null)
}

async function recordGoalId(userId, payload, existing = null) {
  if (!Object.hasOwn(payload, 'goalId')) return existing?.goalId ?? null
  if (payload.goalId === null || payload.goalId === undefined) return null
  const goal = await activeGoal(userId, payload.goalId)
  return goal._id
}

function recordPatchFromPayload(
  payload,
  categoryId,
  categorySnapshotValue,
  goalId,
  existing = null,
) {
  const field = (name, fallback) => (payload[name] === undefined ? fallback : payload[name])

  return {
    date: field('date', existing?.date),
    categoryId,
    categorySnapshot: categorySnapshotValue,
    goalId,
    topic: field('topic', existing?.topic),
    keyTakeaways: field('keyTakeaways', existing?.keyTakeaways ?? ''),
    durationMinutes: field('durationMinutes', existing?.durationMinutes ?? 0),
    notes: field('notes', existing?.notes ?? ''),
    resources: field(
      'resources',
      existing?.resources?.map((resource) => ({
        label: resource.label,
        url: resource.url,
      })) ?? [],
    ),
  }
}

export async function createLearningRecord(userId, payload) {
  const category = await activeCategory(userId, payload.categoryId)
  const goalId = await recordGoalId(userId, payload)
  const fields = recordPatchFromPayload(payload, category._id, categorySnapshot(category), goalId)

  const record = await LearningRecord.create({
    ...fields,
    userId,
    version: 0,
    deletedAt: null,
  })

  return serializeLearningRecord(record)
}

export async function listLearningRecords(userId, query) {
  const filter = { userId }
  if (!query.includeDeleted) filter.deletedAt = null
  if (query.categoryId) filter.categoryId = query.categoryId
  if (query.goalId) filter.goalId = query.goalId
  if (query.from || query.to) {
    filter.date = {}
    if (query.from) filter.date.$gte = query.from
    if (query.to) filter.date.$lte = query.to
  }

  const records = await LearningRecord.find(filter)
    .sort({ date: -1, createdAt: -1 })
    .limit(query.limit)

  return Promise.all(records.map(serializeLearningRecord))
}

export async function getLearningRecord(userId, recordId) {
  const record = await LearningRecord.findOne({ _id: recordId, userId, deletedAt: null })
  if (!record) notFound()
  return serializeLearningRecord(record)
}

export async function updateLearningRecord(userId, recordId, payload) {
  const existing = await LearningRecord.findOne({ _id: recordId, userId, deletedAt: null })
  if (!existing) notFound()

  let categoryId = existing.categoryId
  let snapshot = existing.categorySnapshot
  if (payload.categoryId && payload.categoryId.toString() !== existing.categoryId.toString()) {
    const category = await activeCategory(userId, payload.categoryId)
    categoryId = category._id
    snapshot = categorySnapshot(category)
  }

  const goalId = await recordGoalId(userId, payload, existing)
  const fields = recordPatchFromPayload(payload, categoryId, snapshot, goalId, existing)

  const result = await LearningRecord.updateOne(
    { _id: recordId, userId, version: payload.expectedVersion, deletedAt: null },
    { $set: { ...fields, version: payload.expectedVersion + 1 } },
  )
  if (result.matchedCount === 0) versionConflict()

  return getLearningRecord(userId, recordId)
}

export async function deleteLearningRecord(userId, recordId, expectedVersion) {
  const result = await LearningRecord.updateOne(
    { _id: recordId, userId, version: expectedVersion, deletedAt: null },
    { $set: { deletedAt: new Date(), deletedBy: userId, version: expectedVersion + 1 } },
  )
  if (result.matchedCount === 0) {
    if (!(await LearningRecord.exists({ _id: recordId, userId }))) notFound()
    versionConflict()
  }

  await markLearningFilesDeleted(userId, recordId, userId)
  const deleted = await LearningRecord.findOne({ _id: recordId, userId })
  return serializeLearningRecord(deleted)
}

export async function restoreLearningRecord(userId, recordId, expectedVersion) {
  const result = await LearningRecord.updateOne(
    { _id: recordId, userId, version: expectedVersion, deletedAt: { $ne: null } },
    { $set: { deletedAt: null, deletedBy: null, version: expectedVersion + 1 } },
  )
  if (result.matchedCount === 0) {
    if (!(await LearningRecord.exists({ _id: recordId, userId }))) notFound()
    versionConflict()
  }

  await restoreLearningFiles(userId, recordId)
  return getLearningRecord(userId, recordId)
}

async function goalCategory(userId, payload, existing = null) {
  if (!Object.hasOwn(payload, 'categoryId')) {
    return {
      categoryId: existing?.categoryId ?? null,
      categorySnapshot: existing?.categorySnapshot ?? null,
    }
  }
  if (payload.categoryId === null || payload.categoryId === undefined) {
    return { categoryId: null, categorySnapshot: null }
  }
  if (existing && existing.categoryId?.toString() === payload.categoryId.toString()) {
    return { categoryId: existing.categoryId, categorySnapshot: existing.categorySnapshot }
  }
  const category = await activeCategory(userId, payload.categoryId)
  return { categoryId: category._id, categorySnapshot: categorySnapshot(category) }
}

function goalStatusFields(status, existing = null) {
  if (status === 'active') return { status: 'active', completedAt: null }
  if (status === 'completed') {
    return {
      status: 'completed',
      completedAt: existing?.completedAt ?? new Date(),
    }
  }
  return {}
}

export async function createLearningGoal(userId, payload) {
  const category = await goalCategory(userId, payload)
  const status = payload.status ?? 'active'
  const statusFields = goalStatusFields(status)

  const goal = await LearningGoal.create({
    userId,
    title: payload.title,
    description: payload.description,
    ...category,
    targetDate: payload.targetDate ?? null,
    ...statusFields,
    progressPercent: 0,
    milestones: [],
    tasks: [],
    version: 0,
    deletedAt: null,
  })

  return serializeGoal(goal)
}

export async function listLearningGoals(userId, query) {
  const filter = { userId }
  if (!query.includeDeleted) filter.deletedAt = null
  if (query.categoryId) filter.categoryId = query.categoryId
  if (query.status) filter.status = query.status

  const goals = await LearningGoal.find(filter)
    .sort({ status: 1, targetDate: 1, createdAt: -1 })
    .limit(query.limit)

  return goals.map(serializeGoal)
}

export async function getLearningGoal(userId, goalId) {
  const goal = await LearningGoal.findOne({ _id: goalId, userId, deletedAt: null })
  if (!goal) notFound('The requested learning goal was not found.')
  return serializeGoal(goal)
}

export async function updateLearningGoal(userId, goalId, payload) {
  const existing = await LearningGoal.findOne({ _id: goalId, userId, deletedAt: null })
  if (!existing) notFound('The requested learning goal was not found.')

  const category = await goalCategory(userId, payload, existing)
  const patch = {
    title: payload.title ?? existing.title,
    description: payload.description ?? existing.description,
    categoryId: category.categoryId,
    categorySnapshot: category.categorySnapshot,
    targetDate: payload.targetDate === undefined ? existing.targetDate : payload.targetDate,
    ...(payload.status ? goalStatusFields(payload.status, existing) : {}),
  }

  const result = await LearningGoal.updateOne(
    { _id: goalId, userId, version: payload.expectedVersion, deletedAt: null },
    { $set: { ...patch, version: payload.expectedVersion + 1 } },
  )
  if (result.matchedCount === 0) versionConflict()

  return getLearningGoal(userId, goalId)
}

export async function deleteLearningGoal(userId, goalId, expectedVersion) {
  const result = await LearningGoal.updateOne(
    { _id: goalId, userId, version: expectedVersion, deletedAt: null },
    { $set: { deletedAt: new Date(), deletedBy: userId, version: expectedVersion + 1 } },
  )
  if (result.matchedCount === 0) {
    if (!(await LearningGoal.exists({ _id: goalId, userId }))) {
      notFound('The requested learning goal was not found.')
    }
    versionConflict()
  }

  const deleted = await LearningGoal.findOne({ _id: goalId, userId })
  return serializeGoal(deleted)
}

export async function restoreLearningGoal(userId, goalId, expectedVersion) {
  const result = await LearningGoal.updateOne(
    { _id: goalId, userId, version: expectedVersion, deletedAt: { $ne: null } },
    { $set: { deletedAt: null, deletedBy: null, version: expectedVersion + 1 } },
  )
  if (result.matchedCount === 0) {
    if (!(await LearningGoal.exists({ _id: goalId, userId }))) {
      notFound('The requested learning goal was not found.')
    }
    versionConflict()
  }

  return getLearningGoal(userId, goalId)
}

function milestoneData(milestone) {
  return {
    _id: milestone._id,
    title: milestone.title,
    dueDate: milestone.dueDate ?? null,
    completedAt: milestone.completedAt ?? null,
  }
}

function taskData(task) {
  return {
    _id: task._id,
    title: task.title,
    completedAt: task.completedAt ?? null,
  }
}

async function updateGoalCollections(userId, goal, expectedVersion, milestones, tasks) {
  const result = await LearningGoal.updateOne(
    { _id: goal._id, userId, version: expectedVersion, deletedAt: null },
    {
      $set: {
        milestones,
        tasks,
        progressPercent: computeGoalProgress(milestones, tasks),
        version: expectedVersion + 1,
      },
    },
  )
  if (result.matchedCount === 0) versionConflict()

  return getLearningGoal(userId, goal._id)
}

async function activeGoalDocument(userId, goalId) {
  const goal = await LearningGoal.findOne({ _id: goalId, userId, deletedAt: null })
  if (!goal) notFound('The requested learning goal was not found.')
  return goal
}

export async function addMilestone(userId, goalId, payload) {
  const goal = await activeGoalDocument(userId, goalId)
  const milestones = goal.milestones.map(milestoneData)
  milestones.push({
    _id: new mongoose.Types.ObjectId(),
    title: payload.title,
    dueDate: payload.dueDate ?? null,
    completedAt: null,
  })

  return updateGoalCollections(
    userId,
    goal,
    payload.expectedVersion,
    milestones,
    goal.tasks.map(taskData),
  )
}

export async function updateMilestone(userId, goalId, milestoneId, payload) {
  const goal = await activeGoalDocument(userId, goalId)
  const index = goal.milestones.findIndex(
    (milestone) => milestone._id.toString() === milestoneId.toString(),
  )
  if (index === -1) notFound('The requested milestone was not found.')

  const milestones = goal.milestones.map(milestoneData)
  const current = milestones[index]
  let completedAt = current.completedAt
  if (payload.completed === true && !completedAt) completedAt = new Date()
  if (payload.completed === false) completedAt = null

  milestones[index] = {
    ...current,
    title: payload.title ?? current.title,
    dueDate: payload.dueDate === undefined ? current.dueDate : payload.dueDate,
    completedAt,
  }

  return updateGoalCollections(
    userId,
    goal,
    payload.expectedVersion,
    milestones,
    goal.tasks.map(taskData),
  )
}

export async function deleteMilestone(userId, goalId, milestoneId, expectedVersion) {
  const goal = await activeGoalDocument(userId, goalId)
  const index = goal.milestones.findIndex(
    (milestone) => milestone._id.toString() === milestoneId.toString(),
  )
  if (index === -1) notFound('The requested milestone was not found.')

  const milestones = goal.milestones
    .map(milestoneData)
    .filter((_milestone, milestoneIndex) => milestoneIndex !== index)

  return updateGoalCollections(userId, goal, expectedVersion, milestones, goal.tasks.map(taskData))
}

export async function addTask(userId, goalId, payload) {
  const goal = await activeGoalDocument(userId, goalId)
  const tasks = goal.tasks.map(taskData)
  tasks.push({
    _id: new mongoose.Types.ObjectId(),
    title: payload.title,
    completedAt: null,
  })

  return updateGoalCollections(
    userId,
    goal,
    payload.expectedVersion,
    goal.milestones.map(milestoneData),
    tasks,
  )
}

export async function updateTask(userId, goalId, taskId, payload) {
  const goal = await activeGoalDocument(userId, goalId)
  const index = goal.tasks.findIndex((task) => task._id.toString() === taskId.toString())
  if (index === -1) notFound('The requested task was not found.')

  const tasks = goal.tasks.map(taskData)
  const current = tasks[index]
  let completedAt = current.completedAt
  if (payload.completed === true && !completedAt) completedAt = new Date()
  if (payload.completed === false) completedAt = null

  tasks[index] = {
    ...current,
    title: payload.title ?? current.title,
    completedAt,
  }

  return updateGoalCollections(
    userId,
    goal,
    payload.expectedVersion,
    goal.milestones.map(milestoneData),
    tasks,
  )
}

export async function deleteTask(userId, goalId, taskId, expectedVersion) {
  const goal = await activeGoalDocument(userId, goalId)
  const index = goal.tasks.findIndex((task) => task._id.toString() === taskId.toString())
  if (index === -1) notFound('The requested task was not found.')

  const tasks = goal.tasks.map(taskData).filter((_task, taskIndex) => taskIndex !== index)

  return updateGoalCollections(
    userId,
    goal,
    expectedVersion,
    goal.milestones.map(milestoneData),
    tasks,
  )
}

export async function getLearningSummary(
  userId,
  query,
  { dailyTargetMinutes = 0, today = null } = {},
) {
  if (!today) {
    throw new HttpError(500, 'INTERNAL_ERROR', 'The summary date could not be resolved.')
  }

  const records = await LearningRecord.find({ userId, deletedAt: null })
    .select({ date: 1, durationMinutes: 1 })
    .lean()

  return summarizeLearning(records, {
    today,
    dailyTargetMinutes,
    from: query.from,
    to: query.to,
  })
}
