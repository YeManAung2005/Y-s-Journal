import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, ChevronLeft, ChevronRight, LockKeyhole } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatMoney } from '@/features/analytics/analytics-format'
import { useAuth } from '@/lib/auth-context'
import { formatJournalDate, todayInTimeZone } from '@/lib/date'
import { fetchCalendarMonth } from './calendar-api'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function shiftMonth(month, amount) {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, monthNumber - 1 + amount, 1))
  return date.toISOString().slice(0, 7)
}

function monthLabel(month) {
  const date = new Date(`${month}-01T00:00:00Z`)
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function buildCells(month, days) {
  const firstWeekday = new Date(`${month}-01T00:00:00Z`).getUTCDay()
  const leadingBlanks = (firstWeekday + 6) % 7
  const byDate = new Map(days.map((day) => [day.date, day]))
  const lastDay = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0),
  ).getUTCDate()

  return [
    ...Array.from({ length: leadingBlanks }, (_, index) => ({
      key: `blank-${index}`,
      blank: true,
    })),
    ...Array.from({ length: lastDay }, (_, index) => {
      const date = `${month}-${String(index + 1).padStart(2, '0')}`
      return byDate.get(date) ?? { date, blank: false, tradeCount: 0, studyMinutes: 0 }
    }),
  ]
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/40 p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold">{value}</p>
    </div>
  )
}

export function CalendarPage() {
  const { settings } = useAuth()
  const today = todayInTimeZone(settings?.appTimeZone ?? 'Asia/Yangon')
  const [month, setMonth] = useState(today.slice(0, 7))
  const [selectedDate, setSelectedDate] = useState(null)

  const query = useQuery({
    queryKey: ['calendar', 'month', month],
    queryFn: () => fetchCalendarMonth(month),
  })

  const data = query.data
  const cells = data ? buildCells(month, data.days) : []
  const selectedDay = data?.days.find((day) => day.date === selectedDate) ?? null

  function changeMonth(amount) {
    setMonth((current) => shiftMonth(current, amount))
    setSelectedDate(null)
  }

  if (query.isPending) {
    return <p className="text-sm text-muted-foreground">Loading your calendar…</p>
  }

  if (query.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>The API is unreachable</CardTitle>
          <CardDescription>{query.error?.message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Phase 7 · Calendar</Badge>
            <Badge variant="outline">{settings?.appTimeZone ?? 'Asia/Yangon'}</Badge>
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Review trading and study activity day by day. Journal days can be marked with a neutral
            indicator, but no journal content is ever returned here.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Previous month"
            onClick={() => changeMonth(-1)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <p className="min-w-40 text-center font-mono text-sm font-semibold">
            {monthLabel(month)}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Next month"
            onClick={() => changeMonth(1)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
          {month !== today.slice(0, 7) ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setMonth(today.slice(0, 7))
                setSelectedDate(null)
              }}
            >
              Today
            </Button>
          ) : null}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Metric label="Active days" value={data.summary.activeDays} />
        <Metric label="Trade days" value={data.summary.tradeDays} />
        <Metric label="Study days" value={data.summary.studyDays} />
        <Metric label="Trades" value={data.summary.tradeCount} />
        <Metric label="Study time" value={`${data.summary.studyMinutes} min`} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Month view</CardTitle>
              <CardDescription>Select a day to see its trading and study totals.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
                Trades
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-success" aria-hidden="true" />
                Study
              </span>
              {data.journalIndicatorEnabled ? (
                <span className="flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-full border border-muted-foreground"
                    aria-hidden="true"
                  />
                  Journal marker only
                </span>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] uppercase tracking-wide text-muted-foreground">
            {WEEKDAYS.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1.5">
            {cells.map((cell) =>
              cell.blank ? (
                <div key={cell.key} className="aspect-square rounded-lg bg-secondary/20" />
              ) : (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => setSelectedDate(cell.date)}
                  aria-label={`View ${formatJournalDate(cell.date)}`}
                  className={`flex aspect-square flex-col items-start justify-between rounded-lg border p-1.5 text-left transition-colors sm:p-2 ${
                    selectedDate === cell.date
                      ? 'border-primary bg-primary/10'
                      : cell.date === today
                        ? 'border-primary/40 bg-secondary/40 hover:bg-accent'
                        : 'border-border/70 bg-background/40 hover:bg-accent'
                  }`}
                >
                  <span className="font-mono text-[11px] text-muted-foreground sm:text-xs">
                    {Number(cell.date.slice(-2))}
                  </span>
                  <span className="flex min-h-2 flex-wrap gap-1" aria-hidden="true">
                    {cell.tradeCount > 0 ? (
                      <span className="size-1.5 rounded-full bg-primary" />
                    ) : null}
                    {cell.studyMinutes > 0 ? (
                      <span className="size-1.5 rounded-full bg-success" />
                    ) : null}
                    {cell.hasJournalEntry === true ? (
                      <span className="size-1.5 rounded-full border border-muted-foreground" />
                    ) : null}
                  </span>
                </button>
              ),
            )}
          </div>
        </CardContent>
      </Card>

      {selectedDay ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>{formatJournalDate(selectedDay.date)}</CardTitle>
                <CardDescription>Private activity totals for this day.</CardDescription>
              </div>
              <CalendarDays className="size-4 text-primary" aria-hidden="true" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Metric label="Trades" value={selectedDay.tradeCount} />
              <Metric label="Gross P&L" value={formatMoney(selectedDay.grossPnlMicros)} />
              <Metric label="Net P&L" value={formatMoney(selectedDay.netPnlMicros)} />
              <Metric label="Study" value={`${selectedDay.studyMinutes} min`} />
              <Metric label="Study records" value={selectedDay.studyRecordCount} />
            </div>
            {data.journalIndicatorEnabled ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <LockKeyhole className="size-3.5 text-primary" aria-hidden="true" />
                {selectedDay.hasJournalEntry
                  ? 'A private journal entry exists on this day. Content is not shown.'
                  : 'No private journal entry marker on this day.'}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
