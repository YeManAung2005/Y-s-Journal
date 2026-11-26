import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { ArrowLeft, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { fetchReferenceData } from '@/features/reference/reference-api'
import { deleteTrade, fetchTrade, fetchTrades, restoreTrade } from './trades-api'
import { TradeForm } from './trade-form'

function money(micros) {
  if (micros === null || micros === undefined) return 'Unavailable'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(micros / 1_000_000)
}

function outcomeVariant(outcome) {
  if (outcome === 'win') return 'success'
  if (outcome === 'loss') return 'danger'
  return 'secondary'
}

function Summary({ label, value, hint }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/40 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function TradeDetailPage() {
  const { tradeId } = useParams({ from: '/trades/$tradeId' })
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)

  const tradeQuery = useQuery({
    queryKey: ['trade', tradeId],
    queryFn: async () => {
      try {
        return await fetchTrade(tradeId)
      } catch (error) {
        if (error.status !== 404) throw error
        const list = await fetchTrades({ includeDeleted: true })
        const deleted = list.trades.find((item) => item.id === tradeId)
        if (!deleted) throw error
        return deleted
      }
    },
  })
  const referenceQuery = useQuery({
    queryKey: ['reference-data', false],
    queryFn: () => fetchReferenceData(false),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteTrade(tradeId, tradeQuery.data.trade.version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] })
      void navigate({ to: '/trades' })
    },
  })
  const restoreMutation = useMutation({
    mutationFn: () => restoreTrade(tradeId, tradeQuery.data.trade.version),
    onSuccess: (data) => {
      queryClient.setQueryData(['trade', tradeId], data)
      queryClient.invalidateQueries({ queryKey: ['trades'] })
    },
  })

  if (tradeQuery.isPending || referenceQuery.isPending) {
    return <p className="text-sm text-muted-foreground">Loading trade…</p>
  }

  if (tradeQuery.isError || referenceQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trade unavailable</CardTitle>
          <CardDescription>
            {tradeQuery.error?.message || referenceQuery.error?.message}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to="/trades">Back to trading journal</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const trade = tradeQuery.data.trade

  if (editing) {
    return (
      <div className="space-y-6">
        <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
          <ArrowLeft aria-hidden="true" /> Back to trade
        </Button>
        <TradeForm
          key={`${trade.id}-${trade.version}`}
          trade={trade}
          reference={referenceQuery.data}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            void tradeQuery.refetch()
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/trades">
              <ArrowLeft aria-hidden="true" /> Trading journal
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            {trade.instrumentSnapshot.symbol} {trade.direction} · {trade.tradeDate}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={trade.direction === 'long' ? 'success' : 'danger'}>
              {trade.direction}
            </Badge>
            <Badge variant={outcomeVariant(trade.outcomeNet ?? trade.outcomeGross)}>
              {(trade.outcomeNet ?? trade.outcomeGross).replace('_', ' ')}
            </Badge>
            {trade.deletedAt ? <Badge variant="outline">Deleted</Badge> : null}
            <span className="text-xs text-muted-foreground">Version {trade.version}</span>
          </div>
        </div>
        {!trade.deletedAt ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setEditing(true)}>
              <Pencil aria-hidden="true" /> Edit
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (window.confirm('Move this trade to the trash?')) deleteMutation.mutate()
              }}
            >
              <Trash2 aria-hidden="true" /> Delete
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={restoreMutation.isPending}
            onClick={() => restoreMutation.mutate()}
          >
            <RotateCcw aria-hidden="true" /> Restore
          </Button>
        )}
      </div>

      {deleteMutation.error || restoreMutation.error ? (
        <p className="text-sm text-danger" role="alert">
          {deleteMutation.error?.message || restoreMutation.error?.message}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Summary label="Gross P&L" value={money(trade.grossPnlMicros)} hint={trade.outcomeGross} />
        <Summary
          label="Net P&L"
          value={money(trade.netPnlMicros)}
          hint={trade.outcomeNet ?? 'Unavailable'}
        />
        <Summary
          label="Gross R"
          value={trade.grossR === null ? 'Unavailable' : Number(trade.grossR).toFixed(4)}
          hint={`Risk ${money(trade.selectedRiskMicros)}`}
        />
        <Summary
          label="Average exit"
          value={Number(trade.weightedAverageExitPrice).toFixed(4)}
          hint={`Formula ${trade.formulaVersion}`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Execution</CardTitle>
          <CardDescription>
            {trade.accountSnapshot.name} · {trade.sessionSnapshot?.name || 'No session'} · Entry{' '}
            {trade.entryPrice} · Quantity {trade.quantity}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {trade.exits.map((exit, index) => (
            <div
              key={index}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/40 p-3 text-sm"
            >
              <span>
                Exit {index + 1}: {exit.quantity} @ {exit.price}
              </span>
              <span className="flex flex-wrap gap-4 font-mono">
                <span>Gross {money(exit.grossPnlMicros)}</span>
                <span>Fee {money(exit.allocatedFeeMicros)}</span>
                <span>Net {money(exit.netPnlMicros)}</span>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Review</CardTitle>
            <CardDescription>Private trade reflection.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Followed plan:</span>{' '}
              {trade.review.followedPlan || 'Not reviewed'}
            </p>
            <p>
              <span className="font-medium text-foreground">Confidence:</span>{' '}
              {trade.review.confidence ?? 'Not rated'}
            </p>
            {trade.review.reviewedAt ? <p>Reviewed {trade.review.reviewedAt}</p> : null}
            {trade.review.whatWentWell ? <p>{trade.review.whatWentWell}</p> : null}
            {trade.review.whatToImprove ? <p>{trade.review.whatToImprove}</p> : null}
            {trade.notes ? <p>{trade.notes}</p> : null}
            {trade.lessons ? <p>{trade.lessons}</p> : null}
            {trade.emotions.length > 0 ? <p>Emotions: {trade.emotions.join(', ')}</p> : null}
            {trade.ruleViolations.length > 0 ? (
              <p>Rule violations: {trade.ruleViolations.join(', ')}</p>
            ) : null}
            {trade.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {trade.tags.map((tag) => (
                  <Badge key={tag.id} variant="secondary">
                    {tag.name}
                  </Badge>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Screenshots</CardTitle>
            <CardDescription>Private files served only to the owner.</CardDescription>
          </CardHeader>
          <CardContent>
            {trade.screenshots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No screenshots attached.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {trade.screenshots.map((file) => (
                  <a
                    key={file.id}
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="overflow-hidden rounded-lg border border-border/70 bg-background/40"
                  >
                    <img
                      src={file.url}
                      alt={file.originalName}
                      className="aspect-video h-full w-full object-cover"
                    />
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
