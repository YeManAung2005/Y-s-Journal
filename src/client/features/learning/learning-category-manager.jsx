import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Archive, Check, Pencil, Plus, RotateCcw, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OptionalFields } from '@/components/ui/optional-fields'
import {
  createLearningCategory,
  learningCategoryAction,
  updateLearningCategory,
} from './learning-api'

const EMPTY_CATEGORY = { name: '', color: '#8b5cf6' }

export function LearningCategoryManager({ categories, showArchived, onToggleArchived }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(EMPTY_CATEGORY)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(EMPTY_CATEGORY)

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['learning', 'categories'] })
    queryClient.invalidateQueries({ queryKey: ['learning', 'records'] })
    queryClient.invalidateQueries({ queryKey: ['learning', 'summary'] })
  }

  const createMutation = useMutation({
    mutationFn: () => createLearningCategory(form),
    onSuccess: () => {
      setForm(EMPTY_CATEGORY)
      setShowForm(false)
      refresh()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ categoryId, payload }) => updateLearningCategory(categoryId, payload),
    onSuccess: () => {
      setEditingId(null)
      setEditForm(EMPTY_CATEGORY)
      refresh()
    },
  })

  const actionMutation = useMutation({
    mutationFn: ({ id, action }) => learningCategoryAction(id, action),
    onSuccess: refresh,
  })

  const error = createMutation.error || updateMutation.error || actionMutation.error

  function submitCreate(event) {
    event.preventDefault()
    createMutation.mutate()
  }

  function submitEdit(event, category) {
    event.preventDefault()
    updateMutation.mutate({
      categoryId: category.id,
      payload: { ...editForm, expectedVersion: category.version },
    })
  }

  function startEditing(category) {
    setEditingId(category.id)
    setEditForm({ name: category.name, color: category.color })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <CardTitle>Categories</CardTitle>
          <CardDescription>
            Group study records and goals. Archiving keeps existing snapshots intact.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleArchived}
            aria-expanded={showArchived}
          >
            {showArchived ? 'Hide archived' : 'Show archived'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowForm((value) => !value)}
            aria-expanded={showForm}
          >
            <Plus aria-hidden="true" />
            {showForm ? 'Hide form' : 'Add category'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm ? (
          <form className="space-y-3" onSubmit={submitCreate}>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="space-y-1.5">
                <Label htmlFor="learning-category-name">New category</Label>
                <Input
                  id="learning-category-name"
                  value={form.name}
                  maxLength={80}
                  placeholder="Web development"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  required
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={createMutation.isPending}>
                  <Plus aria-hidden="true" />
                  Add category
                </Button>
              </div>
            </div>
            <OptionalFields>
              <div className="space-y-1.5">
                <Label htmlFor="learning-category-color">Color</Label>
                <Input
                  id="learning-category-color"
                  type="color"
                  className="h-9 w-16 p-1"
                  value={form.color}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, color: event.target.value }))
                  }
                />
              </div>
            </OptionalFields>
          </form>
        ) : null}

        {error ? <p className="text-sm text-danger">{error.message}</p> : null}

        {categories.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
            Add a category before recording study sessions or goals. No sample categories are
            created.
          </p>
        ) : (
          <div className="space-y-2">
            {categories.map((category) => (
              <div
                key={category.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/40 p-3"
              >
                {editingId === category.id ? (
                  <form
                    className="flex flex-1 flex-wrap items-center gap-2"
                    onSubmit={(event) => submitEdit(event, category)}
                  >
                    <Input
                      aria-label="Category name"
                      value={editForm.name}
                      maxLength={80}
                      className="max-w-xs"
                      onChange={(event) =>
                        setEditForm((current) => ({ ...current, name: event.target.value }))
                      }
                      required
                    />
                    <Button
                      type="submit"
                      size="sm"
                      variant="secondary"
                      disabled={updateMutation.isPending}
                    >
                      <Check aria-hidden="true" />
                      Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                    >
                      <X aria-hidden="true" />
                      Cancel
                    </Button>
                    <OptionalFields className="w-full">
                      <Input
                        aria-label="Category color"
                        type="color"
                        className="h-9 w-14 p-1"
                        value={editForm.color}
                        onChange={(event) =>
                          setEditForm((current) => ({ ...current, color: event.target.value }))
                        }
                      />
                    </OptionalFields>
                  </form>
                ) : (
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="size-3 shrink-0 rounded-full border border-white/20"
                      style={{ backgroundColor: category.color }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{category.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {category.slug} · version {category.version}
                      </p>
                    </div>
                    {category.archivedAt ? <Badge variant="secondary">Archived</Badge> : null}
                  </div>
                )}

                {editingId === category.id ? null : (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditing(category)}
                    >
                      <Pencil aria-hidden="true" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={actionMutation.isPending}
                      onClick={() =>
                        actionMutation.mutate({
                          id: category.id,
                          action: category.archivedAt ? 'restore' : 'archive',
                        })
                      }
                    >
                      {category.archivedAt ? (
                        <RotateCcw aria-hidden="true" />
                      ) : (
                        <Archive aria-hidden="true" />
                      )}
                      {category.archivedAt ? 'Restore' : 'Archive'}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
