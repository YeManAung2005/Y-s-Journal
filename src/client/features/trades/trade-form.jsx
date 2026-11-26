import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Plus, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createTrade, updateTrade, uploadScreenshots } from './trades-api'
import { optionalValue } from './trade-form-utils'

const MAX_SCREENSHOTS = 5

function today() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function parseList(value) {
  const seen = new Set()
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter((item) => {
      if (!item) return false
      const key = item.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function initialForm(trade, reference) {
  const checklistAnswers = new Map(
    (trade?.checklist ?? []).map((item) => [item.itemId, item.checked]),
  )

  return {
    accountId:
      trade?.accountId ||
      reference.accounts.find((item) => item.isDefault)?.id ||
      reference.accounts[0]?.id ||
      '',
    instrumentId: trade?.instrumentId || reference.instruments[0]?.id || '',
    tradeDate: trade?.tradeDate || today(),
    direction: trade?.direction || 'long',
    entryPrice: trade?.entryPrice || '',
    quantity: trade?.quantity || '',
    exits: trade?.exits?.length
      ? trade.exits.map((exit) => ({ price: exit.price, quantity: exit.quantity }))
      : [{ price: '', quantity: '' }],
    fees: trade?.fees ?? '',
    initialStopPrice: trade?.initialStopPrice ?? '',
    manualRisk: trade?.manualRisk ?? '',
    sessionId: trade?.sessionId || '',
    tagIds: trade?.tagIds ?? [],
    checklist: reference.checklist.map((item) => ({
      itemId: item.id,
      checked: checklistAnswers.get(item.id) ?? false,
    })),
    emotions: (trade?.emotions ?? []).join(', '),
    ruleViolations: (trade?.ruleViolations ?? []).join(', '),
    notes: trade?.notes ?? '',
    lessons: trade?.lessons ?? '',
    review: {
      followedPlan: trade?.review?.followedPlan ?? '',
      whatWentWell: trade?.review?.whatWentWell ?? '',
      whatToImprove: trade?.review?.whatToImprove ?? '',
      confidence: trade?.review?.confidence ?? '',
      reviewedAt: trade?.review?.reviewedAt ?? '',
    },
  }
}

function Field({ label, children, className = '' }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

export function TradeForm({ trade, reference, onSaved, onCancel }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(() => initialForm(trade, reference))
  const [files, setFiles] = useState([])

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        accountId: form.accountId,
        instrumentId: form.instrumentId,
        tradeDate: form.tradeDate,
        direction: form.direction,
        entryPrice: form.entryPrice,
        quantity: form.quantity,
        exits: form.exits,
        fees: optionalValue(form.fees),
        initialStopPrice: optionalValue(form.initialStopPrice),
        manualRisk: optionalValue(form.manualRisk),
        sessionId: form.sessionId === '' ? null : form.sessionId,
        tagIds: form.tagIds,
        checklist: form.checklist,
        emotions: parseList(form.emotions),
        ruleViolations: parseList(form.ruleViolations),
        notes: form.notes,
        lessons: form.lessons,
        review: {
          followedPlan: form.review.followedPlan || null,
          whatWentWell: form.review.whatWentWell,
          whatToImprove: form.review.whatToImprove,
          confidence: form.review.confidence === '' ? null : Number(form.review.confidence),
          reviewedAt: form.review.reviewedAt || null,
        },
      }

      let saved
      if (trade) {
        saved = await updateTrade(trade.id, { ...payload, expectedVersion: trade.version })
        if (files.length > 0) await uploadScreenshots(trade.id, files)
        return saved
      }

      saved = await createTrade(payload)
      try {
        if (files.length > 0) await uploadScreenshots(saved.trade.id, files)
      } catch (error) {
        error.createdTrade = saved.trade
        throw error
      }
      return saved
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['trades'] })
      queryClient.invalidateQueries({ queryKey: ['trade', saved.trade.id] })
      setFiles([])
      onSaved?.(saved.trade)
    },
    onError: (error) => {
      if (error.createdTrade) onSaved?.(error.createdTrade)
    },
  })

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  function setReview(name, value) {
    setForm((current) => ({ ...current, review: { ...current.review, [name]: value } }))
  }

  function updateExit(index, fieldName, value) {
    setForm((current) => ({
      ...current,
      exits: current.exits.map((exit, exitIndex) =>
        exitIndex === index ? { ...exit, [fieldName]: value } : exit,
      ),
    }))
  }

  function toggleTag(id) {
    setForm((current) => ({
      ...current,
      tagIds: current.tagIds.includes(id)
        ? current.tagIds.filter((tagId) => tagId !== id)
        : [...current.tagIds, id],
    }))
  }

  function toggleChecklist(id) {
    setForm((current) => ({
      ...current,
      checklist: current.checklist.map((item) =>
        item.itemId === id ? { ...item, checked: !item.checked } : item,
      ),
    }))
  }

  function submit(event) {
    event.preventDefault()
    mutation.mutate()
  }

  const errorMessage = mutation.error?.createdTrade
    ? 'The trade was saved, but the screenshots failed to upload. Add them from the trade detail page.'
    : mutation.error?.message

  return (
    <form className="space-y-5" onSubmit={submit}>
      <Card>
        <CardHeader>
          <CardTitle>{trade ? 'Edit trade' : 'Record a completed trade'}</CardTitle>
          <CardDescription>
            Prices, quantities, fees, and risk are recalculated on the server. Nothing is signed or
            sent anywhere else.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Account">
              <Select
                value={form.accountId}
                onChange={(event) => setField('accountId', event.target.value)}
                required
              >
                {reference.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Instrument">
              <Select
                value={form.instrumentId}
                onChange={(event) => setField('instrumentId', event.target.value)}
                required
              >
                {reference.instruments.map((instrument) => (
                  <option key={instrument.id} value={instrument.id}>
                    {instrument.symbol}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Direction">
              <Select
                value={form.direction}
                onChange={(event) => setField('direction', event.target.value)}
              >
                <option value="long">Long</option>
                <option value="short">Short</option>
              </Select>
            </Field>
            <Field label="Trade date">
              <Input
                type="date"
                value={form.tradeDate}
                onChange={(event) => setField('tradeDate', event.target.value)}
                required
              />
            </Field>
            <Field label="Trading session">
              <Select
                value={form.sessionId}
                onChange={(event) => setField('sessionId', event.target.value)}
              >
                <option value="">None</option>
                {reference.tradingSessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Entry price">
              <Input
                inputMode="decimal"
                value={form.entryPrice}
                onChange={(event) => setField('entryPrice', event.target.value)}
                placeholder="25000.00"
                required
              />
            </Field>
            <Field label="Total quantity">
              <Input
                inputMode="decimal"
                value={form.quantity}
                onChange={(event) => setField('quantity', event.target.value)}
                placeholder="3.00"
                required
              />
            </Field>
            <Field label="Total fees">
              <Input
                inputMode="decimal"
                value={form.fees}
                onChange={(event) => setField('fees', event.target.value)}
                placeholder="Leave empty if not entered"
              />
            </Field>
            <Field label="Initial stop">
              <Input
                inputMode="decimal"
                value={form.initialStopPrice}
                onChange={(event) => setField('initialStopPrice', event.target.value)}
                placeholder="Optional"
              />
            </Field>
          </div>

          <Field label="Manual risk override">
            <Input
              inputMode="decimal"
              value={form.manualRisk}
              onChange={(event) => setField('manualRisk', event.target.value)}
              placeholder="Optional USD amount"
              className="sm:max-w-xs"
            />
          </Field>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Partial exits</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    exits: [...current.exits, { price: '', quantity: '' }],
                  }))
                }
              >
                <Plus aria-hidden="true" /> Add exit
              </Button>
            </div>
            {form.exits.map((exit, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-3">
                <Input
                  aria-label={`Exit ${index + 1} price`}
                  inputMode="decimal"
                  placeholder="Exit price"
                  value={exit.price}
                  onChange={(event) => updateExit(index, 'price', event.target.value)}
                  required
                />
                <Input
                  aria-label={`Exit ${index + 1} quantity`}
                  inputMode="decimal"
                  placeholder="Exit quantity"
                  value={exit.quantity}
                  onChange={(event) => updateExit(index, 'quantity', event.target.value)}
                  required
                />
                {form.exits.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        exits: current.exits.filter((_, exitIndex) => exitIndex !== index),
                      }))
                    }
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Execution context</CardTitle>
          <CardDescription>
            Tags and checklist answers are saved as immutable snapshots.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {reference.tags.length > 0 ? (
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2">
                {reference.tags.map((tag) => (
                  <label
                    key={tag.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/70 bg-background/40 px-3 py-2 text-xs"
                  >
                    <input
                      type="checkbox"
                      className="size-3.5"
                      checked={form.tagIds.includes(tag.id)}
                      onChange={() => toggleTag(tag.id)}
                    />
                    {tag.name}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {reference.checklist.length > 0 ? (
            <div className="space-y-2">
              <Label>Pre-trade checklist</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {reference.checklist.map((item) => (
                  <label key={item.id} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 size-3.5"
                      checked={
                        form.checklist.find((answer) => answer.itemId === item.id)?.checked ?? false
                      }
                      onChange={() => toggleChecklist(item.id)}
                    />
                    <span>{item.text}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Emotions">
              <Input
                value={form.emotions}
                onChange={(event) => setField('emotions', event.target.value)}
                placeholder="focused, patient"
              />
            </Field>
            <Field label="Rule violations">
              <Input
                value={form.ruleViolations}
                onChange={(event) => setField('ruleViolations', event.target.value)}
                placeholder="Moved stop, oversized"
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Review</CardTitle>
          <CardDescription>Private trade notes and screenshots.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Followed plan">
              <Select
                value={form.review.followedPlan}
                onChange={(event) => setReview('followedPlan', event.target.value)}
              >
                <option value="">Not reviewed</option>
                <option value="yes">Yes</option>
                <option value="partial">Partially</option>
                <option value="no">No</option>
              </Select>
            </Field>
            <Field label="Confidence">
              <Select
                value={form.review.confidence}
                onChange={(event) => setReview('confidence', event.target.value)}
              >
                <option value="">Not rated</option>
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Review date">
              <Input
                type="date"
                value={form.review.reviewedAt}
                onChange={(event) => setReview('reviewedAt', event.target.value)}
              />
            </Field>
          </div>

          <Field label="What went well">
            <Textarea
              value={form.review.whatWentWell}
              onChange={(event) => setReview('whatWentWell', event.target.value)}
            />
          </Field>
          <Field label="What to improve">
            <Textarea
              value={form.review.whatToImprove}
              onChange={(event) => setReview('whatToImprove', event.target.value)}
            />
          </Field>
          <Field label="Notes">
            <Textarea
              value={form.notes}
              onChange={(event) => setField('notes', event.target.value)}
            />
          </Field>
          <Field label="Lessons">
            <Textarea
              value={form.lessons}
              onChange={(event) => setField('lessons', event.target.value)}
            />
          </Field>

          <Field label={`Screenshots (${files.length}/${MAX_SCREENSHOTS})`}>
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(event) =>
                setFiles(Array.from(event.target.files ?? []).slice(0, MAX_SCREENSHOTS))
              }
            />
          </Field>
        </CardContent>
      </Card>

      {errorMessage ? (
        <p className="text-sm text-danger" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={mutation.isPending || !form.accountId || !form.instrumentId}
        >
          {trade ? <Save aria-hidden="true" /> : <Plus aria-hidden="true" />}
          {mutation.isPending ? 'Saving…' : trade ? 'Save changes' : 'Save trade'}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        {mutation.isSuccess ? (
          <span className="flex items-center gap-1.5 text-sm text-success">
            <Check aria-hidden="true" /> Saved
          </span>
        ) : null}
      </div>
    </form>
  )
}
