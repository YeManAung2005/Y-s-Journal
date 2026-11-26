import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OptionalFields } from '@/components/ui/optional-fields'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/lib/auth-context'
import {
  createLearningRecord,
  updateLearningRecord,
  uploadLearningAttachments,
} from './learning-api'

function today(timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date())
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
    return `${values.year}-${values.month}-${values.day}`
  } catch {
    const now = new Date()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${now.getFullYear()}-${month}-${day}`
  }
}

function initialForm(record, timeZone) {
  return {
    date: record?.date || today(timeZone),
    categoryId: record?.categoryId || '',
    goalId: record?.goalId || '',
    topic: record?.topic || '',
    keyTakeaways: record?.keyTakeaways || '',
    durationMinutes: record?.durationMinutes ?? '',
    notes: record?.notes || '',
    resources:
      record?.resources?.length > 0
        ? record.resources.map((resource) => ({ label: resource.label, url: resource.url }))
        : [{ label: '', url: '' }],
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

export function LearningRecordForm({ record, categories, goals, onSaved, onCancel }) {
  const queryClient = useQueryClient()
  const { settings } = useAuth()
  const [form, setForm] = useState(() => initialForm(record, settings?.appTimeZone))
  const [files, setFiles] = useState([])

  const availableCategories = categories.filter(
    (category) => !category.archivedAt || category.id === form.categoryId,
  )
  const availableGoals = goals.filter((goal) => !goal.deletedAt || goal.id === form.goalId)

  const mutation = useMutation({
    mutationFn: async () => {
      const resources = form.resources
        .map((resource) => ({ label: resource.label.trim(), url: resource.url.trim() }))
        .filter((resource) => resource.url)

      const payload = {
        date: form.date,
        categoryId: form.categoryId,
        goalId: form.goalId || null,
        topic: form.topic,
        keyTakeaways: form.keyTakeaways,
        durationMinutes: form.durationMinutes === '' ? 0 : Number(form.durationMinutes),
        notes: form.notes,
        resources,
      }

      const saved = record
        ? await updateLearningRecord(record.id, {
            ...payload,
            expectedVersion: record.version,
          })
        : await createLearningRecord(payload)

      try {
        if (files.length > 0) await uploadLearningAttachments(saved.record.id, files)
      } catch (error) {
        error.savedRecord = saved.record
        throw error
      }

      return saved
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['learning'] })
      setFiles([])
      onSaved?.(saved.record)
    },
    onError: (error) => {
      if (error.savedRecord) onSaved?.(error.savedRecord)
    },
  })

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  function updateResource(index, name, value) {
    setForm((current) => ({
      ...current,
      resources: current.resources.map((resource, resourceIndex) =>
        resourceIndex === index ? { ...resource, [name]: value } : resource,
      ),
    }))
  }

  function submit(event) {
    event.preventDefault()
    mutation.mutate()
  }

  const errorMessage = mutation.error?.savedRecord
    ? 'The record was saved, but the attachments failed to upload. Add them from the record list.'
    : mutation.error?.message

  return (
    <form className="space-y-5" onSubmit={submit}>
      <Card>
        <CardHeader>
          <CardTitle>{record ? 'Edit study record' : 'Record a study session'}</CardTitle>
          <CardDescription>
            Dates use the app time zone. Study minutes count toward your daily target and streak.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Date">
              <Input
                type="date"
                value={form.date}
                onChange={(event) => setField('date', event.target.value)}
                required
              />
            </Field>
            <Field label="Category">
              <Select
                value={form.categoryId}
                onChange={(event) => setField('categoryId', event.target.value)}
                required
              >
                <option value="">Choose a category</option>
                {availableCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                    {category.archivedAt ? ' (archived)' : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Study minutes">
              <Input
                type="number"
                min="0"
                max="1440"
                step="1"
                value={form.durationMinutes}
                onChange={(event) => setField('durationMinutes', event.target.value)}
                placeholder="45"
              />
            </Field>
          </div>

          <Field label="Topic">
            <Input
              value={form.topic}
              maxLength={160}
              onChange={(event) => setField('topic', event.target.value)}
              placeholder="React hooks and state management"
              required
            />
          </Field>

          <OptionalFields>
            <Field label="Linked goal">
              <Select
                value={form.goalId}
                onChange={(event) => setField('goalId', event.target.value)}
              >
                <option value="">No goal</option>
                {availableGoals.map((goal) => (
                  <option key={goal.id} value={goal.id}>
                    {goal.title}
                    {goal.deletedAt ? ' (deleted)' : ''}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Key takeaways">
                <Textarea
                  value={form.keyTakeaways}
                  maxLength={10000}
                  rows={5}
                  onChange={(event) => setField('keyTakeaways', event.target.value)}
                  placeholder="What should you remember from this session?"
                />
              </Field>
              <Field label="Notes">
                <Textarea
                  value={form.notes}
                  maxLength={20000}
                  rows={5}
                  onChange={(event) => setField('notes', event.target.value)}
                  placeholder="Examples, questions, and follow-up work"
                />
              </Field>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label>Resource links</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      resources: [...current.resources, { label: '', url: '' }],
                    }))
                  }
                >
                  <Plus aria-hidden="true" />
                  Add link
                </Button>
              </div>
              {form.resources.map((resource, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
                  <Input
                    aria-label={`Resource ${index + 1} label`}
                    value={resource.label}
                    maxLength={120}
                    placeholder="Label"
                    onChange={(event) => updateResource(index, 'label', event.target.value)}
                  />
                  <Input
                    aria-label={`Resource ${index + 1} URL`}
                    type="url"
                    value={resource.url}
                    maxLength={2048}
                    placeholder="https://example.com/notes"
                    onChange={(event) => updateResource(index, 'url', event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        resources: current.resources.filter(
                          (_item, resourceIndex) => resourceIndex !== index,
                        ),
                      }))
                    }
                    disabled={form.resources.length === 1}
                    aria-label="Remove resource link"
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>

            <Field label="Attachments">
              <Input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => setFiles([...event.target.files])}
              />
              <p className="text-xs text-muted-foreground">
                Up to five private JPEG, PNG, or WebP images, 10 MB each. Images are re-encoded
                without metadata.
              </p>
            </Field>
          </OptionalFields>
        </CardContent>
      </Card>

      {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={mutation.isPending || !form.categoryId}>
          <Save aria-hidden="true" />
          {mutation.isPending ? 'Saving…' : record ? 'Save changes' : 'Save record'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
