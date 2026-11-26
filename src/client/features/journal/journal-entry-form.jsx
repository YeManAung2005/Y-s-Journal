import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OptionalFields } from '@/components/ui/optional-fields'
import { Textarea } from '@/components/ui/textarea'
import { createJournalEntry, updateJournalEntry } from './journal-api'
import { formatJournalDate } from '@/lib/date'

const MOODS = [
  { value: 1, label: 'Rough' },
  { value: 2, label: 'Low' },
  { value: 3, label: 'Okay' },
  { value: 4, label: 'Good' },
  { value: 5, label: 'Great' },
]

function Field({ label, hint, children, className = '' }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function initialState(entry, date) {
  return {
    date: entry?.date ?? date,
    mood: entry?.mood ?? null,
    highlights: entry?.highlights ?? '',
    challenges: entry?.challenges ?? '',
    lessons: entry?.lessons ?? '',
    gratitude: entry?.gratitude?.length ? [...entry.gratitude] : ['', '', ''],
    reflection: entry?.reflection ?? '',
    freeWriting: entry?.freeWriting ?? '',
    tomorrowPriorities: entry?.tomorrowPriorities?.length
      ? [...entry.tomorrowPriorities]
      : ['', '', '', '', ''],
  }
}

export function JournalEntryForm({ entry, date, onSaved, onCancel }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(() => initialState(entry, date))

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        date: form.date,
        mood: form.mood === null ? null : Number(form.mood),
        highlights: form.highlights,
        challenges: form.challenges,
        lessons: form.lessons,
        gratitude: form.gratitude.map((item) => item.trim()).filter(Boolean),
        reflection: form.reflection,
        freeWriting: form.freeWriting,
        tomorrowPriorities: form.tomorrowPriorities.map((item) => item.trim()).filter(Boolean),
      }

      return entry
        ? updateJournalEntry(entry.id, { ...payload, expectedVersion: entry.version })
        : createJournalEntry(payload)
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['journal'] })
      onSaved?.(result?.entry ?? null)
    },
  })

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  function setListField(name, index, value) {
    setForm((current) => ({
      ...current,
      [name]: current[name].map((item, itemIndex) => (itemIndex === index ? value : item)),
    }))
  }

  function addPriority() {
    setForm((current) => ({
      ...current,
      tomorrowPriorities: [...current.tomorrowPriorities, ''],
    }))
  }

  function removePriority(index) {
    setForm((current) => ({
      ...current,
      tomorrowPriorities: current.tomorrowPriorities.filter(
        (_item, itemIndex) => itemIndex !== index,
      ),
    }))
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault()
        mutation.mutate()
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>
            {entry ? `Edit entry · ${formatJournalDate(entry.date)}` : 'Today’s entry'}
          </CardTitle>
          <CardDescription>
            One entry per day. Everything here stays private to your journal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Field label="Free writing" hint="Anything you want to get out of your head.">
            <Textarea
              value={form.freeWriting}
              maxLength={20000}
              rows={6}
              onChange={(event) => setField('freeWriting', event.target.value)}
              placeholder="Write freely."
            />
          </Field>

          <OptionalFields>
            <Field label="Mood" hint="Leave unset if you do not want to track it.">
              <div className="flex flex-wrap gap-2">
                {MOODS.map((mood) => {
                  const active = form.mood === mood.value
                  return (
                    <button
                      key={mood.value}
                      type="button"
                      onClick={() => setField('mood', active ? null : mood.value)}
                      aria-pressed={active}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? 'border-primary/40 bg-primary/15 text-primary'
                          : 'border-border bg-secondary/40 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {mood.value} · {mood.label}
                    </button>
                  )
                })}
              </div>
            </Field>

            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Highlights">
                <Textarea
                  value={form.highlights}
                  maxLength={5000}
                  rows={4}
                  onChange={(event) => setField('highlights', event.target.value)}
                  placeholder="What went well today?"
                />
              </Field>
              <Field label="Challenges">
                <Textarea
                  value={form.challenges}
                  maxLength={5000}
                  rows={4}
                  onChange={(event) => setField('challenges', event.target.value)}
                  placeholder="What felt hard or unfinished?"
                />
              </Field>
              <Field label="Lessons">
                <Textarea
                  value={form.lessons}
                  maxLength={5000}
                  rows={4}
                  onChange={(event) => setField('lessons', event.target.value)}
                  placeholder="What did today teach you?"
                />
              </Field>
              <Field label="Reflection">
                <Textarea
                  value={form.reflection}
                  maxLength={10000}
                  rows={4}
                  onChange={(event) => setField('reflection', event.target.value)}
                  placeholder="A short reflection on the day."
                />
              </Field>
            </div>

            <Field label="Gratitude" hint="Up to three things.">
              <div className="space-y-2">
                {form.gratitude.map((item, index) => (
                  <Input
                    key={index}
                    aria-label={`Gratitude ${index + 1}`}
                    value={item}
                    maxLength={500}
                    onChange={(event) => setListField('gratitude', index, event.target.value)}
                    placeholder={`Something you appreciate (${index + 1})`}
                  />
                ))}
              </div>
            </Field>

            <Field label="Tomorrow’s priorities" hint="Up to five items.">
              <div className="space-y-2">
                {form.tomorrowPriorities.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      aria-label={`Priority ${index + 1}`}
                      value={item}
                      maxLength={300}
                      onChange={(event) =>
                        setListField('tomorrowPriorities', index, event.target.value)
                      }
                      placeholder={`Priority ${index + 1}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => removePriority(index)}
                      disabled={form.tomorrowPriorities.length <= 1}
                      aria-label={`Remove priority ${index + 1}`}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addPriority}
                  disabled={form.tomorrowPriorities.length >= 5}
                >
                  Add priority
                </Button>
              </div>
            </Field>
          </OptionalFields>
        </CardContent>
      </Card>

      {mutation.error ? <p className="text-sm text-danger">{mutation.error.message}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={mutation.isPending}>
          <Save aria-hidden="true" />
          {mutation.isPending ? 'Saving…' : entry ? 'Save entry' : 'Save today’s entry'}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  )
}
