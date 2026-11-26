import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Image, Plus, Save, ShieldCheck, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { formatJournalDate } from '@/lib/date'
import { fetchTrades } from '@/features/trades/trades-api'
import { PosterPreview } from './poster-preview'
import { drawPoster, exportPosterPng, posterFileName } from './poster-renderer'
import {
  createPosterConfig,
  deletePosterConfig,
  fetchPosterCatalog,
  fetchPosterConfigs,
  fetchPosterData,
  updatePosterConfig,
} from './poster-api'

function newDraft(defaults) {
  return {
    name: 'My poster',
    type: defaults.type,
    template: defaults.template,
    dimension: defaults.dimension,
    accentColor: defaults.accentColor,
    headline: '',
    subtitle: '',
    footer: '',
    logoPosition: defaults.logoPosition,
    days: defaults.days,
    basis: defaults.basis,
    tradeId: null,
  }
}

function toDraft(config) {
  return {
    name: config.name,
    type: config.type,
    template: config.template,
    dimension: config.dimension,
    accentColor: config.accentColor,
    headline: config.headline,
    subtitle: config.subtitle,
    footer: config.footer,
    logoPosition: config.logoPosition,
    days: config.days,
    basis: config.basis,
    tradeId: config.tradeId ?? null,
  }
}

function serializeDraft(draft) {
  return {
    name: draft.name.trim(),
    type: draft.type,
    template: draft.template,
    dimension: draft.dimension,
    accentColor: draft.accentColor,
    headline: draft.headline.trim(),
    subtitle: draft.subtitle.trim(),
    footer: draft.footer.trim(),
    logoPosition: draft.logoPosition,
    days: Number(draft.days),
    basis: draft.basis,
    tradeId: draft.type === 'trade' ? draft.tradeId : null,
  }
}

function TemplateSwatch({ template, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`rounded-lg border p-3 text-left transition-colors ${
        selected
          ? 'border-primary bg-primary/10'
          : 'border-border/70 bg-background/40 hover:bg-accent/70'
      }`}
    >
      <span className="flex items-center gap-1.5" aria-hidden="true">
        <span
          className="size-5 rounded border"
          style={{ background: template.palette.background, borderColor: template.palette.border }}
        />
        <span
          className="size-5 rounded border"
          style={{ background: template.palette.panel, borderColor: template.palette.border }}
        />
        <span className="size-5 rounded" style={{ background: template.palette.glow }} />
      </span>
      <span className="mt-2 block text-sm font-medium">{template.label}</span>
      <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
        {template.description}
      </span>
    </button>
  )
}

export function PosterPage() {
  const queryClient = useQueryClient()
  const canvasRef = useRef(null)
  const [selectedId, setSelectedId] = useState(undefined)
  const [selectedVersion, setSelectedVersion] = useState(undefined)
  const [draftState, setDraftState] = useState(undefined)
  const [feedback, setFeedback] = useState(null)

  const catalogQuery = useQuery({
    queryKey: ['posters', 'catalog'],
    queryFn: fetchPosterCatalog,
  })
  const configsQuery = useQuery({
    queryKey: ['posters', 'configs'],
    queryFn: fetchPosterConfigs,
  })

  const catalog = catalogQuery.data
  const configs = configsQuery.data?.configs ?? []
  const autoConfig = configs[0] ?? null

  const fallbackDraft = useMemo(() => {
    if (autoConfig) return toDraft(autoConfig)
    if (catalog) return newDraft(catalog.defaults)
    return null
  }, [autoConfig, catalog])

  const draft = draftState ?? fallbackDraft
  const activeSelectedId = selectedId === undefined ? (autoConfig?.id ?? null) : selectedId
  const activeSelectedVersion =
    selectedVersion === undefined ? (autoConfig?.version ?? null) : selectedVersion

  const normalizedDays = Math.min(365, Math.max(7, Number(draft?.days) || 30))
  const tradesQuery = useQuery({
    queryKey: ['posters', 'trades'],
    queryFn: () => fetchTrades({ limit: 100 }),
    enabled: draft?.type === 'trade',
  })
  const trades = tradesQuery.data?.trades ?? []
  const activeTradeId = draft?.tradeId ?? trades[0]?.id ?? null
  const selectedTrade = trades.find((trade) => trade.id === activeTradeId) ?? null

  const dataQuery = useQuery({
    queryKey: ['posters', 'data', draft?.type, normalizedDays, draft?.basis, activeTradeId],
    queryFn: () =>
      fetchPosterData({
        type: draft.type,
        days: normalizedDays,
        basis: draft.basis,
        tradeId: draft.type === 'trade' ? activeTradeId : undefined,
      }),
    enabled: Boolean(draft?.type && draft?.basis && (draft.type !== 'trade' || activeTradeId)),
  })

  const selectedTemplate =
    catalog?.templates.find((template) => template.id === draft?.template) ?? catalog?.templates[0]
  const selectedDimension =
    catalog?.dimensions.find((dimension) => dimension.id === draft?.dimension) ??
    catalog?.dimensions[0]
  const selectedType = catalog?.types.find((type) => type.id === draft?.type)

  function invalidateConfigs() {
    return queryClient.invalidateQueries({ queryKey: ['posters', 'configs'] })
  }

  function updateDraft(patch) {
    setDraftState((current) => ({ ...(current ?? fallbackDraft), ...patch }))
  }

  function resetToNew() {
    if (!catalog) return
    setSelectedId(null)
    setSelectedVersion(null)
    setDraftState(newDraft(catalog.defaults))
    setFeedback(null)
  }

  function selectConfig(config) {
    setSelectedId(config.id)
    setSelectedVersion(config.version)
    setDraftState(toDraft(config))
    setFeedback(null)
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = serializeDraft({
        ...draft,
        tradeId: draft.type === 'trade' ? activeTradeId : null,
      })
      if (activeSelectedId && activeSelectedVersion !== null) {
        return updatePosterConfig(activeSelectedId, {
          ...payload,
          expectedVersion: activeSelectedVersion,
        })
      }
      return createPosterConfig(payload)
    },
    onSuccess: async (result) => {
      setSelectedId(result.config.id)
      setSelectedVersion(result.config.version)
      setDraftState(toDraft(result.config))
      setFeedback({
        type: 'success',
        message: `Saved poster “${result.config.name}”.`,
      })
      await invalidateConfigs()
    },
    onError: (error) => setFeedback({ type: 'error', message: error.message }),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deletePosterConfig(activeSelectedId, activeSelectedVersion),
    onSuccess: async (result) => {
      resetToNew()
      setFeedback({
        type: 'success',
        message: `Deleted poster “${result.config.name}”.`,
      })
      await invalidateConfigs()
    },
    onError: (error) => setFeedback({ type: 'error', message: error.message }),
  })

  async function handleExport() {
    const data = dataQuery.data
    const canvas = canvasRef.current
    if (!data || !canvas || !selectedTemplate || !selectedDimension) return

    canvas.width = selectedDimension.width
    canvas.height = selectedDimension.height
    const context = canvas.getContext('2d')
    if (!context) {
      setFeedback({ type: 'error', message: 'PNG export is not available in this browser.' })
      return
    }

    drawPoster(context, {
      config: draft,
      data,
      template: selectedTemplate,
      dimension: selectedDimension,
    })

    try {
      await exportPosterPng(canvas, posterFileName(draft))
      setFeedback({ type: 'success', message: 'PNG exported locally.' })
    } catch (error) {
      setFeedback({ type: 'error', message: error.message })
    }
  }

  if (catalogQuery.isPending || configsQuery.isPending) {
    return <p className="text-sm text-muted-foreground">Loading Poster Studio…</p>
  }

  const failed = [catalogQuery, configsQuery].find((query) => query.isError)
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

  if (!draft || !catalog || !selectedTemplate || !selectedDimension) {
    return <p className="text-sm text-muted-foreground">Preparing your poster…</p>
  }

  const daysValid = Number(draft.days) >= 7 && Number(draft.days) <= 365
  const nameValid = draft.name.trim().length > 0
  const colorValid = /^#[0-9a-fA-F]{6}$/.test(draft.accentColor)
  const tradeValid = draft.type !== 'trade' || Boolean(activeTradeId)
  const canSave = daysValid && nameValid && colorValid && tradeValid && !saveMutation.isPending
  const mutationError = saveMutation.error ?? deleteMutation.error

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
              <Badge>Phase 8 · Poster Studio</Badge>
              <Badge variant="success">
                <ShieldCheck aria-hidden="true" />
                Private by design
              </Badge>
            </div>
            <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Poster Studio
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Turn allowlisted trading, study, or single-trade metrics into a private poster. The
              live preview and PNG export run entirely in this browser; no journal content is ever
              read.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={resetToNew}>
              <Plus aria-hidden="true" />
              New poster
            </Button>
            <Button
              type="button"
              disabled={!dataQuery.data || dataQuery.isPending}
              onClick={() => void handleExport()}
            >
              <Download aria-hidden="true" />
              Export PNG
            </Button>
          </div>
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Saved posters</CardTitle>
              <CardDescription>
                Open a saved design or start a new one. Names are unique per owner.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {configs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No saved posters yet. Configure the design and save it below.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {configs.map((config) => (
                    <button
                      key={config.id}
                      type="button"
                      onClick={() => selectConfig(config)}
                      aria-pressed={activeSelectedId === config.id}
                      className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                        activeSelectedId === config.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border/70 bg-background/40 hover:bg-accent/70'
                      }`}
                    >
                      <span className="block text-sm font-medium">{config.name}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {catalog.types.find((type) => type.id === config.type)?.label ??
                          config.type}{' '}
                        · v{config.version}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Design</CardTitle>
              <CardDescription>Choose a template, canvas, and accent.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-medium">Template</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {catalog.templates.map((template) => (
                    <TemplateSwatch
                      key={template.id}
                      template={template}
                      selected={draft.template === template.id}
                      onSelect={() => updateDraft({ template: template.id })}
                    />
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="poster-dimension">Canvas size</Label>
                  <Select
                    id="poster-dimension"
                    value={draft.dimension}
                    onChange={(event) => updateDraft({ dimension: event.target.value })}
                  >
                    {catalog.dimensions.map((dimension) => (
                      <option key={dimension.id} value={dimension.id}>
                        {dimension.label} · {dimension.width}×{dimension.height}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="poster-logo">Logo placement</Label>
                  <Select
                    id="poster-logo"
                    value={draft.logoPosition}
                    onChange={(event) => updateDraft({ logoPosition: event.target.value })}
                  >
                    <option value="top-left">Top left</option>
                    <option value="top-right">Top right</option>
                    <option value="bottom-left">Bottom left</option>
                    <option value="bottom-right">Bottom right</option>
                    <option value="none">No logo</option>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="poster-accent">Accent color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="poster-accent"
                    type="color"
                    value={colorValid ? draft.accentColor : '#8b5cf6'}
                    onChange={(event) => updateDraft({ accentColor: event.target.value })}
                    className="h-9 w-14 cursor-pointer p-1"
                  />
                  <Input
                    aria-label="Accent hex value"
                    value={draft.accentColor}
                    maxLength={7}
                    onChange={(event) => updateDraft({ accentColor: event.target.value })}
                    className="w-32 font-mono"
                  />
                  {!colorValid ? (
                    <span className="text-xs text-danger">Use a #RRGGBB hex color.</span>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Poster data</CardTitle>
              <CardDescription>
                Only allowlisted trading, learning, or completed-trade totals are used. Journal data
                is never read.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {catalog.types.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => updateDraft({ type: type.id })}
                    aria-pressed={draft.type === type.id}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      draft.type === type.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border/70 bg-background/40 hover:bg-accent/70'
                    }`}
                  >
                    <span className="block text-sm font-medium">{type.label}</span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                      {type.description}
                    </span>
                  </button>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {draft.type === 'trade' ? (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="poster-trade">Completed trade</Label>
                    {tradesQuery.isPending ? (
                      <p className="flex h-9 items-center text-sm text-muted-foreground">
                        Loading completed trades…
                      </p>
                    ) : trades.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Record a completed trade first, then return to Poster Studio.
                      </p>
                    ) : (
                      <Select
                        id="poster-trade"
                        value={activeTradeId ?? ''}
                        onChange={(event) => updateDraft({ tradeId: event.target.value })}
                      >
                        {trades.map((trade) => (
                          <option key={trade.id} value={trade.id}>
                            {trade.instrumentSnapshot.symbol}{' '}
                            {trade.direction === 'long' ? 'Long' : 'Short'} ·{' '}
                            {formatJournalDate(trade.tradeDate)} ·{' '}
                            {trade.outcomeGross === 'win'
                              ? 'Win'
                              : trade.outcomeGross === 'loss'
                                ? 'Loss'
                                : 'Break even'}
                          </option>
                        ))}
                      </Select>
                    )}
                    {selectedTrade ? (
                      <p className="text-xs text-muted-foreground">
                        ROI on risk = {draft.basis === 'net' ? 'net' : 'gross'} P&L ÷ selected risk.
                        {selectedTrade.selectedRiskMicros === null
                          ? ' This trade has no risk value, so ROI is unavailable.'
                          : ''}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="poster-days">Period</Label>
                    <Input
                      id="poster-days"
                      type="number"
                      min="7"
                      max="365"
                      value={draft.days}
                      onChange={(event) => updateDraft({ days: event.target.value })}
                    />
                    {!daysValid ? (
                      <p className="text-xs text-danger">Choose between 7 and 365 days.</p>
                    ) : null}
                  </div>
                )}

                {draft.type === 'trading' || draft.type === 'trade' ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="poster-basis">P&L basis</Label>
                    <Select
                      id="poster-basis"
                      value={draft.basis}
                      onChange={(event) => updateDraft({ basis: event.target.value })}
                    >
                      <option value="gross">Gross</option>
                      <option value="net">Net</option>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label>Study target</Label>
                    <p className="flex h-9 items-center text-sm text-muted-foreground">
                      Uses your daily study target from Settings.
                    </p>
                  </div>
                )}
              </div>

              {dataQuery.isError ? (
                <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                  {dataQuery.error?.message}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Text</CardTitle>
              <CardDescription>Leave a field empty to use the generated default.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="poster-headline">Headline</Label>
                <Input
                  id="poster-headline"
                  value={draft.headline}
                  maxLength={80}
                  placeholder={selectedType?.label ?? 'Poster headline'}
                  onChange={(event) => updateDraft({ headline: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="poster-subtitle">Subtitle</Label>
                <Input
                  id="poster-subtitle"
                  value={draft.subtitle}
                  maxLength={140}
                  placeholder="Period, focus, or context"
                  onChange={(event) => updateDraft({ subtitle: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="poster-footer">Footer</Label>
                <Input
                  id="poster-footer"
                  value={draft.footer}
                  maxLength={100}
                  placeholder="Private by design · Generated locally"
                  onChange={(event) => updateDraft({ footer: event.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Save poster</CardTitle>
              <CardDescription>
                {activeSelectedId
                  ? 'Update the open poster, or delete it permanently.'
                  : 'Save this design to reopen and export it later.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="poster-name">Name</Label>
                <Input
                  id="poster-name"
                  value={draft.name}
                  maxLength={80}
                  onChange={(event) => updateDraft({ name: event.target.value })}
                />
                {!nameValid ? <p className="text-xs text-danger">A name is required.</p> : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" disabled={!canSave} onClick={() => saveMutation.mutate()}>
                  <Save aria-hidden="true" />
                  {activeSelectedId ? 'Update poster' : 'Save poster'}
                </Button>
                {activeSelectedId ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (window.confirm(`Delete the “${draft.name}” poster?`)) {
                        deleteMutation.mutate()
                      }
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                    Delete
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle>Live preview</CardTitle>
                  <CardDescription>
                    {selectedType?.label} · {selectedDimension.width}×{selectedDimension.height}
                  </CardDescription>
                </div>
                <Badge variant="outline">
                  <Image aria-hidden="true" />
                  PNG
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {draft.type === 'trade' && !activeTradeId ? (
                <div className="grid min-h-80 place-items-center rounded-xl border border-dashed border-border/70 bg-background/40 text-center text-sm text-muted-foreground">
                  Choose a completed trade to render its ROI poster.
                </div>
              ) : dataQuery.isPending ? (
                <div className="grid min-h-80 place-items-center rounded-xl border border-dashed border-border/70 bg-background/40 text-sm text-muted-foreground">
                  Rendering your poster data…
                </div>
              ) : dataQuery.data ? (
                <PosterPreview
                  canvasRef={canvasRef}
                  config={draft}
                  data={dataQuery.data}
                  template={selectedTemplate}
                  dimension={selectedDimension}
                />
              ) : (
                <div className="grid min-h-80 place-items-center rounded-xl border border-dashed border-danger/40 bg-danger/5 text-sm text-danger">
                  Poster data could not be loaded.
                </div>
              )}
              <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
                The preview is a canvas rendered at full export resolution. PNG export downloads
                locally and never uploads your data.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
