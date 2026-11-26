import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  LayoutDashboard,
  Plus,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import {
  formatInteger,
  formatMoney,
  formatMultiple,
  formatPercent,
} from '@/features/analytics/analytics-format'
import { useAuth } from '@/lib/auth-context'
import { formatJournalDate } from '@/lib/date'
import {
  createDashboardLayout,
  deleteDashboardLayout,
  fetchDashboardData,
  fetchDashboardLayouts,
  fetchWidgetCatalog,
  setDefaultDashboardLayout,
  updateDashboardLayout,
} from './dashboard-api'

const SIZE_LABELS = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
}

function Metric({ label, value, tone = 'default' }) {
  return (
    <div className="flex h-full min-h-20 flex-col justify-between gap-1 rounded-lg border border-border/70 bg-background/40 p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`font-mono text-lg font-semibold leading-tight ${
          tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : ''
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function sizeClass(widget) {
  if (widget.id === 'calendar_activity') return 'sm:col-span-2 lg:col-span-3'
  if (widget.size === 'small') return 'sm:col-span-1'
  if (widget.size === 'large') return 'sm:col-span-2 lg:col-span-3'
  return 'sm:col-span-2'
}

function toneForMicros(value) {
  if (value === null || value === undefined) return 'default'
  if (value > 0) return 'success'
  if (value < 0) return 'danger'
  return 'default'
}

const WEEKDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']
const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' })

function buildYearHeatmap(from, to, days) {
  const byDate = new Map(days.map((day) => [day.date, day]))
  const start = new Date(`${from}T00:00:00Z`)
  start.setUTCDate(start.getUTCDate() - start.getUTCDay())
  const end = new Date(`${to}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()))

  const weeks = []
  const months = []
  let lastMonth = null
  const cursor = new Date(start)

  while (cursor <= end) {
    const week = []
    for (let row = 0; row < 7; row += 1) {
      const date = cursor.toISOString().slice(0, 10)
      const inRange = date >= from && date <= to
      week.push(
        inRange
          ? (byDate.get(date) ?? {
              date,
              tradeCount: 0,
              studyMinutes: 0,
              studyRecordCount: 0,
            })
          : { date, outside: true },
      )
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }

    const firstInRange = week.find((day) => !day.outside)
    if (firstInRange) {
      const monthKey = firstInRange.date.slice(0, 7)
      if (monthKey !== lastMonth) {
        months.push({
          key: monthKey,
          week: weeks.length,
          label: MONTH_FORMATTER.format(new Date(`${monthKey}-01T00:00:00Z`)),
        })
        lastMonth = monthKey
      }
    }

    weeks.push(week)
  }

  return { weeks, months }
}

function activityLevel(day) {
  if (!day || (day.tradeCount === 0 && day.studyMinutes === 0)) return 0
  if (day.tradeCount > 0 && day.studyMinutes > 0) return 4
  if (day.tradeCount > 0) return 3
  if (day.studyMinutes >= 60) return 3
  return 2
}

const ACTIVITY_COLORS = [
  'bg-secondary/50',
  'bg-primary/25',
  'bg-primary/45',
  'bg-primary/70',
  'bg-primary',
]

function activityTitle(day) {
  if (!day) return ''
  const parts = [formatJournalDate(day.date)]
  if (day.tradeCount > 0) {
    parts.push(`${day.tradeCount} ${day.tradeCount === 1 ? 'trade' : 'trades'}`)
  }
  if (day.studyMinutes > 0) parts.push(`${day.studyMinutes} min study`)
  if (day.tradeCount === 0 && day.studyMinutes === 0) parts.push('No activity')
  return parts.join(' · ')
}

function TradesWidget({ data }) {
  const summary = data.summary
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 items-stretch gap-3 lg:grid-cols-4">
        <Metric label="Trades" value={formatInteger(summary.tradeCount)} />
        <Metric
          label={`${data.basis} P&L`}
          value={formatMoney(summary.totalPnlMicros)}
          tone={toneForMicros(summary.totalPnlMicros)}
        />
        <Metric label="Win rate" value={formatPercent(summary.winRate)} />
        <Metric label="Average R" value={formatMultiple(summary.averageR)} />
      </div>
      <p className="text-xs text-muted-foreground">
        {data.from} to {data.to}
        {data.basis === 'net' && !summary.netComplete
          ? ' · Net P&L is unavailable because some fees are missing.'
          : ''}
      </p>
    </div>
  )
}

function StudyWidget({ data }) {
  const summary = data.summary
  const target =
    summary.dailyTargetMinutes > 0
      ? `${summary.todayMinutes}/${summary.dailyTargetMinutes} min`
      : `${summary.todayMinutes} min`
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))] items-stretch gap-3">
      <Metric label="Today" value={target} />
      <Metric label="Current streak" value={`${formatInteger(summary.currentStreak)} days`} />
      <Metric label="Longest streak" value={`${formatInteger(summary.longestStreak)} days`} />
      <Metric label="Period total" value={`${formatInteger(summary.totalMinutes)} min`} />
    </div>
  )
}

function CalendarActivityWidget({ data }) {
  const summary = data.summary
  const { weeks, months } = buildYearHeatmap(data.from, data.to, data.days ?? [])
  const monthLabels = new Map(months.map((month) => [month.week, month.label]))
  const columns = `1.5rem repeat(${weeks.length}, minmax(0, 1fr))`

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Last 12 months</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatInteger(summary.activeDays)} active days · {formatInteger(summary.tradeCount)}{' '}
            trades · {formatInteger(summary.studyMinutes)} min study
          </p>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span>Less</span>
          {ACTIVITY_COLORS.map((color) => (
            <span key={color} className={`size-2.5 rounded-[2px] ${color}`} aria-hidden="true" />
          ))}
          <span>More</span>
        </div>
      </div>

      <div className="space-y-1">
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: columns }}>
          <span aria-hidden="true" />
          {weeks.map((_, index) => (
            <span
              key={index}
              className="min-w-0 overflow-visible whitespace-nowrap text-[10px] leading-4 text-muted-foreground"
            >
              {monthLabels.get(index) ?? ''}
            </span>
          ))}
        </div>

        <div
          className="grid grid-flow-col gap-[3px]"
          style={{
            gridTemplateColumns: columns,
            gridTemplateRows: 'repeat(7, auto)',
          }}
        >
          {WEEKDAY_LABELS.map((label, row) => (
            <span
              key={`weekday-${row}`}
              className="flex items-center justify-end pr-1 text-[10px] leading-none text-muted-foreground"
            >
              {label}
            </span>
          ))}
          {weeks.flatMap((week, weekIndex) =>
            week.map((cell, row) =>
              cell.outside ? (
                <span
                  key={`${weekIndex}-${row}`}
                  className="aspect-square w-full rounded-[2px] bg-transparent"
                  aria-hidden="true"
                />
              ) : (
                <span
                  key={cell.date}
                  title={activityTitle(cell)}
                  aria-label={activityTitle(cell)}
                  className={`aspect-square w-full rounded-[2px] ${ACTIVITY_COLORS[activityLevel(cell)]}`}
                />
              ),
            ),
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>{formatInteger(summary.tradeDays)} trade days</span>
        <span>{formatInteger(summary.studyDays)} study days</span>
        <span>{formatInteger(summary.tradeCount)} trades</span>
        <span>{formatInteger(summary.studyMinutes)} min studied</span>
      </div>
    </div>
  )
}

function GoalsWidget({ data }) {
  return (
    <div className="space-y-3">
      {data.goals.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active learning goals yet.</p>
      ) : (
        data.goals.map((goal) => (
          <div key={goal.id} className="rounded-lg border border-border/70 bg-background/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-medium">{goal.title}</p>
              <span className="font-mono text-xs text-primary">{goal.progressPercent}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${goal.progressPercent}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Target {goal.targetDate ? formatJournalDate(goal.targetDate) : 'not set'}
            </p>
          </div>
        ))
      )}
    </div>
  )
}

function WidgetContent({ widget }) {
  switch (widget.id) {
    case 'trades_summary':
      return <TradesWidget data={widget.data} />
    case 'study_summary':
      return <StudyWidget data={widget.data} />
    case 'calendar_activity':
      return <CalendarActivityWidget data={widget.data} />
    case 'goals_progress':
      return <GoalsWidget data={widget.data} />
    default:
      return <p className="text-sm text-muted-foreground">This widget is not available.</p>
  }
}

export function DashboardPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [selectedLayoutId, setSelectedLayoutId] = useState(null)
  const [customizing, setCustomizing] = useState(false)
  const [draftWidgets, setDraftWidgets] = useState([])
  const [creatingLayout, setCreatingLayout] = useState(false)
  const [newLayoutName, setNewLayoutName] = useState('')
  const [feedback, setFeedback] = useState(null)

  const layoutsQuery = useQuery({
    queryKey: ['dashboard', 'layouts'],
    queryFn: fetchDashboardLayouts,
  })
  const catalogQuery = useQuery({
    queryKey: ['dashboard', 'widgets'],
    queryFn: fetchWidgetCatalog,
  })
  const layouts = layoutsQuery.data?.layouts ?? []
  const catalog = catalogQuery.data?.widgets ?? []
  const activeLayoutId = selectedLayoutId ?? layouts.find((layout) => layout.isDefault)?.id ?? null
  const dashboardQuery = useQuery({
    queryKey: ['dashboard', 'data', activeLayoutId],
    queryFn: () => fetchDashboardData(activeLayoutId),
    enabled: Boolean(activeLayoutId),
  })

  const draftRows = useMemo(
    () => [...draftWidgets].sort((left, right) => left.position - right.position),
    [draftWidgets],
  )

  function invalidateDashboard() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'layouts'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'data'] }),
    ])
  }

  function openCustomize() {
    const current = dashboardQuery.data?.layout?.widgets ?? []
    const entries = catalog
      .map((entry) => {
        const existing = current.find((widget) => widget.id === entry.id)
        return existing
          ? {
              ...existing,
              size: entry.id === 'calendar_activity' ? 'large' : existing.size,
              settings: { ...existing.settings },
            }
          : {
              id: entry.id,
              visible: false,
              size: entry.defaultSize,
              position: 0,
              settings: { ...entry.defaultSettings },
            }
      })
      .map((widget, position) => ({ ...widget, position }))
    setDraftWidgets(entries)
    setCustomizing(true)
    setFeedback(null)
  }

  function updateDraft(widgetId, patch) {
    setDraftWidgets((current) =>
      current.map((widget) => (widget.id === widgetId ? { ...widget, ...patch } : widget)),
    )
  }

  function updateDraftSetting(widgetId, key, value) {
    setDraftWidgets((current) =>
      current.map((widget) =>
        widget.id === widgetId
          ? { ...widget, settings: { ...widget.settings, [key]: value } }
          : widget,
      ),
    )
  }

  function moveDraft(widgetId, direction) {
    setDraftWidgets((current) => {
      const ordered = [...current].sort((left, right) => left.position - right.position)
      const index = ordered.findIndex((widget) => widget.id === widgetId)
      const next = index + direction
      if (index === -1 || next < 0 || next >= ordered.length) return current
      ;[ordered[index], ordered[next]] = [ordered[next], ordered[index]]
      return ordered.map((widget, position) => ({ ...widget, position }))
    })
  }

  const saveLayoutMutation = useMutation({
    mutationFn: () =>
      updateDashboardLayout(activeLayoutId, {
        widgets: draftRows.map((widget, position) => ({ ...widget, position })),
        expectedVersion: dashboardQuery.data.layout.version,
      }),
    onSuccess: async (result) => {
      setCustomizing(false)
      setFeedback({ type: 'success', message: `Saved layout “${result.layout.name}”.` })
      await invalidateDashboard()
    },
    onError: (error) => setFeedback({ type: 'error', message: error.message }),
  })

  const createLayoutMutation = useMutation({
    mutationFn: () =>
      createDashboardLayout({
        name: newLayoutName.trim(),
        widgets: catalog.map((entry, position) => ({
          id: entry.id,
          visible: true,
          size: entry.defaultSize,
          position,
          settings: { ...entry.defaultSettings },
        })),
      }),
    onSuccess: async (result) => {
      setNewLayoutName('')
      setSelectedLayoutId(result.layout.id)
      setCreatingLayout(false)
      setCustomizing(false)
      setFeedback({ type: 'success', message: `Created layout “${result.layout.name}”.` })
      await invalidateDashboard()
    },
    onError: (error) => setFeedback({ type: 'error', message: error.message }),
  })

  const defaultLayoutMutation = useMutation({
    mutationFn: (layout) => setDefaultDashboardLayout(layout.id, layout.version),
    onSuccess: async (result) => {
      setFeedback({ type: 'success', message: `“${result.layout.name}” is now the default.` })
      await invalidateDashboard()
    },
    onError: (error) => setFeedback({ type: 'error', message: error.message }),
  })

  const deleteLayoutMutation = useMutation({
    mutationFn: (layout) => deleteDashboardLayout(layout.id, layout.version),
    onSuccess: async (result) => {
      setSelectedLayoutId(null)
      setCustomizing(false)
      setFeedback({ type: 'success', message: `Deleted layout “${result.layout.name}”.` })
      await invalidateDashboard()
    },
    onError: (error) => setFeedback({ type: 'error', message: error.message }),
  })

  if (layoutsQuery.isPending || catalogQuery.isPending) {
    return <p className="text-sm text-muted-foreground">Loading your dashboard…</p>
  }

  const failed = [layoutsQuery, catalogQuery, dashboardQuery].find((query) => query.isError)
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

  if (!activeLayoutId || dashboardQuery.isPending || !dashboardQuery.data) {
    return <p className="text-sm text-muted-foreground">Preparing your default dashboard…</p>
  }

  const activeLayout = dashboardQuery.data.layout
  const activeWidgets = dashboardQuery.data.widgets
  const mutationError = [
    saveLayoutMutation.error,
    createLayoutMutation.error,
    defaultLayoutMutation.error,
    deleteLayoutMutation.error,
  ].find(Boolean)

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/60 p-6 shadow-[0_32px_80px_-56px_rgb(0_0_0/1)] sm:p-8">
        <div
          className="pointer-events-none absolute -right-24 -top-32 size-80 rounded-full bg-primary/15 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Phase 7 · Dashboard</Badge>
              <Badge variant="outline">{activeLayout.name}</Badge>
              <Badge variant="success">
                <ShieldCheck aria-hidden="true" />
                Private by design
              </Badge>
            </div>
            <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Welcome back, {user?.displayName}.
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Build a workspace from trading analytics, learning progress, and activity. Personal
              Journal content is never included in dashboard widgets.
            </p>
          </div>
          <Button type="button" onClick={openCustomize}>
            <SlidersHorizontal aria-hidden="true" />
            Customize
          </Button>
        </div>
      </section>

      {feedback || mutationError ? (
        <div
          role="status"
          className={`rounded-lg border px-4 py-3 text-sm ${
            feedback?.type === 'error' || mutationError
              ? 'border-danger/30 bg-danger/10 text-danger'
              : 'border-success/30 bg-success/10 text-success'
          }`}
        >
          {mutationError?.message ?? feedback?.message}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Dashboard layout"
          value={activeLayout.id}
          onChange={(event) => {
            setSelectedLayoutId(event.target.value)
            setCustomizing(false)
            setCreatingLayout(false)
            setFeedback(null)
          }}
          className="w-48"
        >
          {layouts.map((layout) => (
            <option key={layout.id} value={layout.id}>
              {layout.name}
              {layout.isDefault ? ' (default)' : ''}
            </option>
          ))}
        </Select>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setCreatingLayout((current) => !current)
            setFeedback(null)
          }}
        >
          <Plus aria-hidden="true" />
          New layout
        </Button>

        {!activeLayout.isDefault ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={defaultLayoutMutation.isPending}
            onClick={() => defaultLayoutMutation.mutate(activeLayout)}
          >
            Set default
          </Button>
        ) : null}

        {!activeLayout.isDefault ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={deleteLayoutMutation.isPending}
            onClick={() => {
              if (window.confirm(`Delete the “${activeLayout.name}” layout?`)) {
                deleteLayoutMutation.mutate(activeLayout)
              }
            }}
          >
            <Trash2 aria-hidden="true" />
            Delete
          </Button>
        ) : null}

        {creatingLayout ? (
          <form
            className="flex items-center gap-1.5"
            onSubmit={(event) => {
              event.preventDefault()
              if (newLayoutName.trim()) createLayoutMutation.mutate()
            }}
          >
            <Label htmlFor="new-layout-name" className="sr-only">
              New layout name
            </Label>
            <Input
              id="new-layout-name"
              autoFocus
              placeholder="Layout name"
              maxLength={60}
              value={newLayoutName}
              onChange={(event) => setNewLayoutName(event.target.value)}
              className="h-8 w-40"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!newLayoutName.trim() || createLayoutMutation.isPending}
            >
              Add
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setCreatingLayout(false)
                setNewLayoutName('')
              }}
            >
              Cancel
            </Button>
          </form>
        ) : null}
      </div>

      {customizing ? (
        <Card>
          <CardHeader>
            <CardTitle>Widget library</CardTitle>
            <CardDescription>
              Show, hide, resize, and reorder widgets. Changes are saved together with the layout
              version so stale edits cannot overwrite newer ones.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {draftRows.map((widget) => {
              const entry = catalog.find((item) => item.id === widget.id)
              return (
                <div
                  key={widget.id}
                  className="grid gap-3 rounded-lg border border-border/70 bg-background/40 p-3 md:grid-cols-[1.5fr_1fr_1fr_auto]"
                >
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={widget.visible}
                      onChange={(event) =>
                        updateDraft(widget.id, { visible: event.target.checked })
                      }
                      className="mt-1 size-4 accent-[var(--primary)]"
                    />
                    <span>
                      <span className="block text-sm font-medium">{entry?.title ?? widget.id}</span>
                      <span className="block text-xs text-muted-foreground">
                        {entry?.description}
                      </span>
                    </span>
                  </label>

                  <div className="space-y-1.5">
                    <Label htmlFor={`size-${widget.id}`}>Size</Label>
                    {widget.id === 'calendar_activity' ? (
                      <p className="flex h-9 items-center text-sm text-muted-foreground">
                        Full width
                      </p>
                    ) : (
                      <Select
                        id={`size-${widget.id}`}
                        value={widget.size}
                        onChange={(event) => updateDraft(widget.id, { size: event.target.value })}
                      >
                        {Object.entries(SIZE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {(widget.id === 'trades_summary' || widget.id === 'study_summary') && (
                      <>
                        <Label htmlFor={`days-${widget.id}`}>Days</Label>
                        <Input
                          id={`days-${widget.id}`}
                          type="number"
                          min="7"
                          max="365"
                          value={widget.settings?.days ?? 30}
                          onChange={(event) =>
                            updateDraftSetting(widget.id, 'days', Number(event.target.value))
                          }
                        />
                      </>
                    )}
                    {widget.id === 'trades_summary' && (
                      <>
                        <Label htmlFor="basis-trades_summary">Basis</Label>
                        <Select
                          id="basis-trades_summary"
                          value={widget.settings?.basis ?? 'gross'}
                          onChange={(event) =>
                            updateDraftSetting(widget.id, 'basis', event.target.value)
                          }
                        >
                          <option value="gross">Gross</option>
                          <option value="net">Net</option>
                        </Select>
                      </>
                    )}
                  </div>

                  <div className="flex items-start gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Move ${entry?.title ?? widget.id} up`}
                      disabled={widget.position === 0}
                      onClick={() => moveDraft(widget.id, -1)}
                    >
                      <ArrowUp aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Move ${entry?.title ?? widget.id} down`}
                      disabled={widget.position === draftRows.length - 1}
                      onClick={() => moveDraft(widget.id, 1)}
                    >
                      <ArrowDown aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              )
            })}

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button
                type="button"
                disabled={saveLayoutMutation.isPending}
                onClick={() => saveLayoutMutation.mutate()}
              >
                <Save aria-hidden="true" />
                Save layout
              </Button>
              <Button type="button" variant="ghost" onClick={() => setCustomizing(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {activeWidgets.length === 0 ? (
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>No visible widgets</CardTitle>
              <CardDescription>Open Customize to add widgets to this layout.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button type="button" onClick={openCustomize}>
                <LayoutDashboard aria-hidden="true" />
                Choose widgets
              </Button>
            </CardContent>
          </Card>
        ) : (
          activeWidgets.map((widget) => (
            <Card key={widget.id} className={sizeClass(widget)}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{widget.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <WidgetContent widget={widget} />
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
