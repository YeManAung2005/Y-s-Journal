import { DashboardLayout } from '../models/dashboard-layout.js'
import { HttpError } from '../lib/http-error.js'
import { todayInTimeZone } from '../lib/timezone.js'
import { getSummary } from './analytics-service.js'
import { getActivityRange } from './calendar-service.js'
import { getLearningSummary, listLearningGoals } from './learning-service.js'
import { getOrCreateSettings } from './settings-service.js'

export const WIDGET_CATALOG = [
  {
    id: 'trades_summary',
    title: 'Trading summary',
    description: 'Trade count, selected-basis P&L, win rate, and average R.',
    defaultSize: 'medium',
    defaultSettings: { basis: 'gross', days: 30 },
  },
  {
    id: 'study_summary',
    title: 'Study rhythm',
    description: "Today's minutes, current streak, and longest streak.",
    defaultSize: 'small',
    defaultSettings: { days: 30 },
  },
  {
    id: 'calendar_activity',
    title: 'Activity calendar',
    description: 'A full-width, GitHub-style year heatmap of trading and study activity.',
    defaultSize: 'large',
    defaultSettings: {},
  },
  {
    id: 'goals_progress',
    title: 'Goals in progress',
    description: 'Active learning goals with server-calculated progress.',
    defaultSize: 'medium',
    defaultSettings: {},
  },
]

function catalogEntry(id) {
  return WIDGET_CATALOG.find((widget) => widget.id === id) ?? null
}

function shiftDate(date, days) {
  const [year, month, day] = date.split('-').map(Number)
  const result = new Date(Date.UTC(year, month - 1, day + days))
  return result.toISOString().slice(0, 10)
}

function serializeLayout(layout) {
  return {
    id: layout._id.toString(),
    name: layout.name,
    isDefault: layout.isDefault,
    widgets: [...layout.widgets]
      .sort((a, b) => a.position - b.position)
      .map((widget) => ({
        id: widget.id,
        visible: widget.visible,
        size: widget.size,
        position: widget.position,
        settings: widget.settings ?? {},
      })),
    version: layout.version,
    updatedAt: layout.updatedAt,
  }
}

function defaultWidgets() {
  return WIDGET_CATALOG.map((widget, index) => ({
    id: widget.id,
    visible: true,
    size: widget.defaultSize,
    position: index,
    settings: { ...widget.defaultSettings },
  }))
}

function conflict(message) {
  throw new HttpError(409, 'CONFLICT', message)
}

function notFound(message = 'The requested dashboard layout was not found.') {
  throw new HttpError(404, 'NOT_FOUND', message)
}

function staleVersion() {
  throw new HttpError(409, 'VERSION_CONFLICT', 'This layout changed. Reload and try again.')
}

async function ownedLayout(userId, layoutId) {
  const layout = await DashboardLayout.findOne({ _id: layoutId, userId })
  if (!layout) notFound()
  return layout
}

async function makeDefault(userId, layoutId, { bumpTarget = true } = {}) {
  await DashboardLayout.updateMany(
    { userId, _id: { $ne: layoutId }, isDefault: true },
    { $set: { isDefault: false } },
  )
  const update = { $set: { isDefault: true } }
  if (bumpTarget) update.$inc = { version: 1 }
  const result = await DashboardLayout.updateOne({ _id: layoutId, userId }, update)
  if (result.matchedCount === 0) notFound()
}

export async function listDashboardLayouts(userId) {
  await ensureDefaultLayout(userId)
  const layouts = await DashboardLayout.find({ userId }).sort({ isDefault: -1, updatedAt: -1 })
  return layouts.map(serializeLayout)
}

export async function ensureDefaultLayout(userId) {
  const existing = await DashboardLayout.findOne({ userId }).sort({ isDefault: -1, createdAt: 1 })
  if (existing) {
    if (!existing.isDefault) await makeDefault(userId, existing._id)
    return DashboardLayout.findOne({ _id: existing._id, userId })
  }

  try {
    return await DashboardLayout.create({
      userId,
      name: 'Default dashboard',
      isDefault: true,
      widgets: defaultWidgets(),
      version: 0,
    })
  } catch (error) {
    if (error?.code === 11000) {
      const fallback = await DashboardLayout.findOne({ userId })
      if (fallback && !fallback.isDefault) await makeDefault(userId, fallback._id)
      return fallback
    }
    throw error
  }
}

export async function createDashboardLayout(userId, payload) {
  if (await DashboardLayout.exists({ userId, name: payload.name })) {
    conflict('A dashboard layout with that name already exists.')
  }

  let layout
  try {
    layout = await DashboardLayout.create({
      userId,
      name: payload.name,
      isDefault: false,
      widgets: payload.widgets,
      version: 0,
    })
  } catch (error) {
    if (error?.code === 11000) conflict('A dashboard layout with that name already exists.')
    throw error
  }

  if (payload.isDefault) await makeDefault(userId, layout._id)
  return serializeLayout(await DashboardLayout.findOne({ _id: layout._id, userId }))
}

export async function updateDashboardLayout(userId, layoutId, payload) {
  if (
    payload.name &&
    (await DashboardLayout.exists({ userId, name: payload.name, _id: { $ne: layoutId } }))
  ) {
    conflict('A dashboard layout with that name already exists.')
  }

  const set = {}
  for (const field of ['name', 'isDefault', 'widgets']) {
    if (payload[field] !== undefined) set[field] = payload[field]
  }
  if (set.isDefault === true) set.isDefault = false

  const result = await DashboardLayout.updateOne(
    { _id: layoutId, userId, version: payload.expectedVersion },
    { $set: set, $inc: { version: 1 } },
  )
  if (result.matchedCount === 0) {
    if (!(await DashboardLayout.exists({ _id: layoutId, userId }))) notFound()
    staleVersion()
  }

  if (payload.isDefault === true) await makeDefault(userId, layoutId, { bumpTarget: false })
  return serializeLayout(await ownedLayout(userId, layoutId))
}

export async function deleteDashboardLayout(userId, layoutId, expectedVersion) {
  const layout = await ownedLayout(userId, layoutId)
  if (layout.isDefault) {
    throw new HttpError(
      409,
      'DEFAULT_LAYOUT',
      'Set another layout as default before deleting this one.',
    )
  }

  const result = await DashboardLayout.deleteOne({
    _id: layoutId,
    userId,
    version: expectedVersion,
  })
  if (result.deletedCount === 0) staleVersion()
  return serializeLayout(layout)
}

export async function setDefaultDashboardLayout(userId, layoutId, expectedVersion) {
  const layout = await ownedLayout(userId, layoutId)
  if (layout.version !== expectedVersion) staleVersion()
  await makeDefault(userId, layoutId)
  return serializeLayout(await ownedLayout(userId, layoutId))
}

async function resolveTradesSummary(userId, widget, { today }) {
  const basis = widget.settings?.basis ?? 'gross'
  const days = widget.settings?.days ?? 30
  const from = shiftDate(today, -(days - 1))
  const summary = await getSummary(userId, { basis, from, to: today })

  return {
    basis,
    days,
    from,
    to: today,
    summary: {
      tradeCount: summary.tradeCount,
      totalPnlMicros: summary.totalPnlMicros,
      netPnlMicros: summary.netPnlMicros,
      winRate: summary.winRate,
      averageR: summary.averageR,
      netAvailable: summary.coverage?.netAvailable ?? 0,
      netComplete: summary.coverage?.netComplete ?? false,
    },
  }
}

async function resolveStudySummary(userId, widget, { settings, today }) {
  const days = widget.settings?.days ?? 30
  const from = shiftDate(today, -(days - 1))
  const summary = await getLearningSummary(
    userId,
    { from, to: today },
    {
      dailyTargetMinutes: settings.dailyStudyTargetMinutes,
      today,
    },
  )

  return {
    days,
    from,
    to: today,
    summary: {
      dailyTargetMinutes: summary.dailyTargetMinutes,
      todayMinutes: summary.todayMinutes,
      currentStreak: summary.currentStreak,
      longestStreak: summary.longestStreak,
      totalMinutes: summary.totalMinutes,
      recordCount: summary.recordCount,
      targetMetToday: summary.targetMetToday,
    },
  }
}

async function resolveCalendarActivity(userId, _widget, { today }) {
  const from = shiftDate(today, -364)
  const days = await getActivityRange(userId, from, today)

  const summary = days.reduce(
    (totals, day) => ({
      activeDays: totals.activeDays + (day.tradeCount > 0 || day.studyRecordCount > 0 ? 1 : 0),
      tradeDays: totals.tradeDays + (day.tradeCount > 0 ? 1 : 0),
      studyDays: totals.studyDays + (day.studyRecordCount > 0 ? 1 : 0),
      tradeCount: totals.tradeCount + day.tradeCount,
      studyMinutes: totals.studyMinutes + day.studyMinutes,
      studyRecordCount: totals.studyRecordCount + day.studyRecordCount,
    }),
    {
      activeDays: 0,
      tradeDays: 0,
      studyDays: 0,
      tradeCount: 0,
      studyMinutes: 0,
      studyRecordCount: 0,
    },
  )

  return { from, to: today, summary, days }
}

async function resolveGoalsProgress(userId) {
  const goals = await listLearningGoals(userId, { status: 'active', limit: 5 })
  return {
    goals: goals.map((goal) => ({
      id: goal.id,
      title: goal.title,
      status: goal.status,
      targetDate: goal.targetDate,
      progressPercent: goal.progressPercent,
    })),
  }
}

const RESOLVERS = {
  trades_summary: resolveTradesSummary,
  study_summary: resolveStudySummary,
  calendar_activity: resolveCalendarActivity,
  goals_progress: resolveGoalsProgress,
}

export async function getDashboardData(userId, query = {}) {
  const settings = await getOrCreateSettings(userId)
  const layout = query.layoutId
    ? await ownedLayout(userId, query.layoutId)
    : await ensureDefaultLayout(userId)
  const today = todayInTimeZone(settings.appTimeZone)
  const context = { settings, today }

  const widgets = []
  for (const widget of [...layout.widgets].sort((a, b) => a.position - b.position)) {
    if (!widget.visible) continue
    const resolver = RESOLVERS[widget.id]
    if (!resolver) continue
    const catalog = catalogEntry(widget.id)
    widgets.push({
      id: widget.id,
      title: catalog?.title ?? widget.id,
      size: widget.id === 'calendar_activity' ? 'large' : widget.size,
      data: await resolver(userId, widget, context),
    })
  }

  return { layout: serializeLayout(layout), widgets }
}
