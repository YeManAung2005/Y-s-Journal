import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BookOpen,
  Clock,
  ExternalLink,
  Flame,
  Pencil,
  Plus,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react'
import { addDays } from '@shared/learning/streaks.js'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import {
  deleteLearningAttachment,
  deleteLearningRecord,
  fetchLearningCategories,
  fetchLearningGoals,
  fetchLearningRecords,
  fetchLearningSummary,
} from './learning-api'
import { LearningCategoryManager } from './learning-category-manager'
import { LearningGoalsSection } from './learning-goals-section'
import { LearningRecordForm } from './learning-record-form'

const INITIAL_FILTERS = { from: '', to: '', categoryId: '', goalId: '' }

function Metric({ label, value, hint, tone = 'default' }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/40 p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`mt-1 font-mono text-lg font-semibold ${
          tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : ''
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function StudySummary({ summary }) {
  const byDate = new Map(summary.days.map((day) => [day.date, day]))
  const recentDates = Array.from({ length: 14 }, (_value, index) =>
    addDays(summary.today, index - 13),
  )
  const maxMinutes = Math.max(
    summary.dailyTargetMinutes,
    ...summary.days.map((day) => day.minutes),
    1,
  )
  const targetProgress =
    summary.dailyTargetMinutes > 0
      ? Math.min(100, Math.round((summary.todayMinutes / summary.dailyTargetMinutes) * 100))
      : summary.todayMinutes > 0
        ? 100
        : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Study rhythm</CardTitle>
        <CardDescription>
          A study day counts toward your streak when total minutes reach your daily target in the
          app time zone. Today is {summary.today}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Today"
            value={`${summary.todayMinutes} min`}
            hint={
              summary.dailyTargetMinutes > 0
                ? `${targetProgress}% of ${summary.dailyTargetMinutes} min target`
                : 'No daily target set'
            }
            tone={summary.targetMetToday ? 'success' : 'default'}
          />
          <Metric
            label="Current streak"
            value={`${summary.currentStreak} day${summary.currentStreak === 1 ? '' : 's'}`}
            hint={summary.lastStudyDate ? `Last studied ${summary.lastStudyDate}` : 'No study yet'}
            tone={summary.currentStreak > 0 ? 'success' : 'default'}
          />
          <Metric
            label="Longest streak"
            value={`${summary.longestStreak} day${summary.longestStreak === 1 ? '' : 's'}`}
            hint={`${summary.qualifyingDays} qualifying day${summary.qualifyingDays === 1 ? '' : 's'}`}
          />
          <Metric
            label="Recorded study"
            value={`${summary.totalMinutes} min`}
            hint={`${summary.recordCount} record${summary.recordCount === 1 ? '' : 's'} across ${summary.activeDays} day${summary.activeDays === 1 ? '' : 's'}`}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Today&apos;s target</span>
            <span className="font-mono">{targetProgress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-[width] ${
                summary.targetMetToday ? 'bg-success' : 'bg-primary'
              }`}
              style={{ width: `${targetProgress}%` }}
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Last 14 days
            </p>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-sm bg-success" /> target met
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-sm bg-primary/40" /> studied
              </span>
            </div>
          </div>
          <div className="flex h-24 items-end gap-1">
            {recentDates.map((date) => {
              const day = byDate.get(date)
              const height = day ? Math.max(6, Math.round((day.minutes / maxMinutes) * 100)) : 3
              return (
                <div key={date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-sm ${
                      !day ? 'bg-muted' : day.targetMet ? 'bg-success' : 'bg-primary/40'
                    } ${date === summary.today ? 'ring-1 ring-primary' : ''}`}
                    style={{ height: `${height}%` }}
                    title={`${date}: ${day?.minutes ?? 0} min`}
                  />
                  <span className="text-[9px] text-muted-foreground">{date.slice(8)}</span>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function RecordCard({ record, goals, onEdit, onDelete, onDeleteAttachment, deleting }) {
  const goal = goals.find((item) => item.id === record.goalId)

  return (
    <div className="space-y-3 rounded-lg border border-border/70 bg-background/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{record.date}</span>
            {record.categorySnapshot ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-2 py-0.5 text-[11px]">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: record.categorySnapshot.color }}
                  aria-hidden="true"
                />
                {record.categorySnapshot.name}
              </span>
            ) : null}
            <Badge variant="outline">{record.durationMinutes} min</Badge>
            {goal ? <Badge variant="secondary">Goal: {goal.title}</Badge> : null}
          </div>
          <h3 className="text-base font-semibold">{record.topic}</h3>
          {record.keyTakeaways ? (
            <p className="max-w-3xl whitespace-pre-wrap text-sm text-muted-foreground">
              {record.keyTakeaways}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" size="sm" variant="ghost" onClick={() => onEdit(record)}>
            <Pencil aria-hidden="true" />
            Edit
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onDelete(record)}
            disabled={deleting}
            aria-label="Move study record to trash"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>

      {record.notes || record.resources.length > 0 || record.attachments.length > 0 ? (
        <details className="rounded-md border border-border/60 bg-background/20 p-3">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            Notes, links, and attachments
            {record.attachments.length > 0
              ? ` · ${record.attachments.length} attachment${record.attachments.length === 1 ? '' : 's'}`
              : ''}
          </summary>
          <div className="mt-3 space-y-4">
            {record.notes ? (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{record.notes}</p>
            ) : null}

            {record.resources.length > 0 ? (
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Resources
                </p>
                {record.resources.map((resource) => (
                  <a
                    key={`${resource.label}-${resource.url}`}
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                    {resource.label || resource.url}
                  </a>
                ))}
              </div>
            ) : null}

            {record.attachments.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {record.attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className="group relative overflow-hidden rounded-md border border-border/70"
                  >
                    <a href={attachment.url} target="_blank" rel="noreferrer">
                      <img
                        src={attachment.url}
                        alt={attachment.originalName}
                        className="h-24 w-full object-cover"
                      />
                    </a>
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      className="absolute right-1 top-1 size-6 opacity-90"
                      onClick={() => onDeleteAttachment(attachment)}
                      aria-label={`Delete ${attachment.originalName}`}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  )
}

export function LearningPage() {
  const queryClient = useQueryClient()
  const [showArchivedCategories, setShowArchivedCategories] = useState(false)
  const [showRecordForm, setShowRecordForm] = useState(false)
  const [editingRecord, setEditingRecord] = useState(null)
  const [filters, setFilters] = useState(INITIAL_FILTERS)

  const categoriesQuery = useQuery({
    queryKey: ['learning', 'categories'],
    queryFn: () => fetchLearningCategories(true),
  })
  const goalsQuery = useQuery({
    queryKey: ['learning', 'goals'],
    queryFn: () => fetchLearningGoals({ includeDeleted: true }),
  })
  const recordsQuery = useQuery({
    queryKey: ['learning', 'records', filters],
    queryFn: () => fetchLearningRecords(filters),
  })
  const summaryQuery = useQuery({
    queryKey: ['learning', 'summary'],
    queryFn: () => fetchLearningSummary(),
  })

  const deleteRecordMutation = useMutation({
    mutationFn: ({ id, version }) => deleteLearningRecord(id, version),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['learning'] }),
  })

  const deleteAttachmentMutation = useMutation({
    mutationFn: (fileId) => deleteLearningAttachment(fileId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['learning'] }),
  })

  if (
    categoriesQuery.isPending ||
    goalsQuery.isPending ||
    recordsQuery.isPending ||
    summaryQuery.isPending
  ) {
    return <p className="text-sm text-muted-foreground">Loading learning workspace…</p>
  }

  const queries = [categoriesQuery, goalsQuery, recordsQuery, summaryQuery]
  const failed = queries.find((query) => query.isError)
  if (failed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>The API is unreachable</CardTitle>
          <CardDescription>{failed.error?.message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" onClick={() => void failed.refetch()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    )
  }

  const categories = categoriesQuery.data.categories
  const allGoals = goalsQuery.data.goals
  const goals = allGoals.filter((goal) => !goal.deletedAt)
  const records = recordsQuery.data.records
  const summary = summaryQuery.data.summary
  const activeCategories = categories.filter((category) => !category.archivedAt)
  const managedCategories = showArchivedCategories
    ? categories
    : categories.filter((category) => !category.archivedAt)

  function setFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }))
  }

  function openNewRecord() {
    setEditingRecord(null)
    setShowRecordForm((value) => !value)
  }

  function closeRecordForm() {
    setShowRecordForm(false)
    setEditingRecord(null)
  }

  function deleteRecord(record) {
    if (window.confirm('Move this study record to the trash?')) {
      deleteRecordMutation.mutate({ id: record.id, version: record.version })
    }
  }

  function deleteAttachment(attachment) {
    if (window.confirm('Delete this attachment?')) {
      deleteAttachmentMutation.mutate(attachment.id)
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
          <BookOpen className="size-3.5" aria-hidden="true" />
          Learning
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Learning tracker</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Record study sessions, keep private notes and images, and turn long-term plans into
          milestones and tasks. Learning data is isolated from trading analytics and the personal
          journal.
        </p>
      </header>

      <StudySummary summary={summary} />

      <LearningCategoryManager
        categories={managedCategories}
        showArchived={showArchivedCategories}
        onToggleArchived={() => setShowArchivedCategories((value) => !value)}
      />

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Study records</h2>
            <p className="text-xs text-muted-foreground">
              {records.length} record{records.length === 1 ? '' : 's'} in the current filter.
            </p>
          </div>
          <Button
            type="button"
            onClick={openNewRecord}
            disabled={activeCategories.length === 0}
            title={activeCategories.length === 0 ? 'Create an active category first' : undefined}
          >
            <Plus aria-hidden="true" />
            {showRecordForm ? 'Hide form' : 'New record'}
          </Button>
        </div>

        {showRecordForm || editingRecord ? (
          <LearningRecordForm
            key={editingRecord?.id ?? 'new-record'}
            record={editingRecord}
            categories={categories}
            goals={allGoals}
            onSaved={closeRecordForm}
            onCancel={closeRecordForm}
          />
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>
              Filter by date, category, or linked goal. Streaks always use your full history.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="learning-filter-from">From</Label>
                <Input
                  id="learning-filter-from"
                  type="date"
                  value={filters.from}
                  onChange={(event) => setFilter('from', event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="learning-filter-to">To</Label>
                <Input
                  id="learning-filter-to"
                  type="date"
                  value={filters.to}
                  onChange={(event) => setFilter('to', event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="learning-filter-category">Category</Label>
                <Select
                  id="learning-filter-category"
                  value={filters.categoryId}
                  onChange={(event) => setFilter('categoryId', event.target.value)}
                >
                  <option value="">All categories</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                      {category.archivedAt ? ' (archived)' : ''}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="learning-filter-goal">Goal</Label>
                <Select
                  id="learning-filter-goal"
                  value={filters.goalId}
                  onChange={(event) => setFilter('goalId', event.target.value)}
                >
                  <option value="">All goals</option>
                  {goals.map((goal) => (
                    <option key={goal.id} value={goal.id}>
                      {goal.title}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFilters(INITIAL_FILTERS)}
              >
                Clear filters
              </Button>
              {deleteRecordMutation.error || deleteAttachmentMutation.error ? (
                <p className="text-sm text-danger">
                  {(deleteRecordMutation.error || deleteAttachmentMutation.error).message}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {records.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
            No study records match this filter. Record a session or clear the filters.
          </p>
        ) : (
          <div className="space-y-3">
            {records.map((record) => (
              <RecordCard
                key={record.id}
                record={record}
                goals={allGoals}
                onEdit={(item) => {
                  setShowRecordForm(false)
                  setEditingRecord(item)
                }}
                onDelete={deleteRecord}
                onDeleteAttachment={deleteAttachment}
                deleting={deleteRecordMutation.isPending}
              />
            ))}
          </div>
        )}
      </section>

      <LearningGoalsSection goals={goals} categories={categories} />

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border/70 bg-background/40 p-4">
          <Clock className="size-4 text-primary" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium">Daily study target</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Currently {summary.dailyTargetMinutes} minutes. Change it in Settings.
          </p>
        </div>
        <div className="rounded-lg border border-border/70 bg-background/40 p-4">
          <Flame className="size-4 text-primary" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium">Streak rule</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Any study minutes count when the target is zero. Otherwise the day must reach the
            target.
          </p>
        </div>
        <div className="rounded-lg border border-border/70 bg-background/40 p-4">
          <Target className="size-4 text-primary" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium">Private by default</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Attachments are owner-only and are never served from a public folder.
          </p>
        </div>
      </section>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <TrendingUp className="size-3.5" aria-hidden="true" />
        Goal progress is computed from completed milestones and tasks.
      </div>
    </div>
  )
}
