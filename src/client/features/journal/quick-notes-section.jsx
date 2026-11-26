import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { NotebookPen, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OptionalFields } from '@/components/ui/optional-fields'
import { Textarea } from '@/components/ui/textarea'
import { createQuickNote, deleteQuickNote, restoreQuickNote, updateQuickNote } from './journal-api'
import { formatJournalDate } from '@/lib/date'

export function QuickNotesSection({ notes, date }) {
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const [noteDate, setNoteDate] = useState(date)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editingText, setEditingText] = useState('')

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['journal'] })
  }

  const createMutation = useMutation({
    mutationFn: () => createQuickNote({ date: noteDate, text: text.trim() }),
    onSuccess: () => {
      setText('')
      setShowForm(false)
      refresh()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, version }) =>
      updateQuickNote(id, { text: editingText.trim(), expectedVersion: version }),
    onSuccess: () => {
      setEditingId(null)
      setEditingText('')
      refresh()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: ({ id, version }) => deleteQuickNote(id, version),
    onSuccess: refresh,
  })

  const restoreMutation = useMutation({
    mutationFn: ({ id, version }) => restoreQuickNote(id, version),
    onSuccess: refresh,
  })

  const error =
    createMutation.error || updateMutation.error || deleteMutation.error || restoreMutation.error

  const activeNotes = notes.filter((note) => !note.deletedAt)
  const deletedNotes = notes.filter((note) => note.deletedAt)

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <CardTitle>Quick notes</CardTitle>
          <CardDescription>
            Capture a thought in seconds. Notes stay in your journal and are never included in
            trading, learning, or dashboard data.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowForm((value) => !value)}
          aria-expanded={showForm}
        >
          <Plus aria-hidden="true" />
          {showForm ? 'Hide form' : 'Add note'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm ? (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault()
              if (!text.trim()) return
              createMutation.mutate()
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="quick-note-text">Note</Label>
              <Textarea
                id="quick-note-text"
                value={text}
                maxLength={5000}
                rows={3}
                onChange={(event) => setText(event.target.value)}
                placeholder="A thought, a reminder, an idea…"
              />
            </div>
            <OptionalFields>
              <div className="space-y-1.5 sm:max-w-xs">
                <Label htmlFor="quick-note-date">Date</Label>
                <Input
                  id="quick-note-date"
                  type="date"
                  value={noteDate}
                  onChange={(event) => setNoteDate(event.target.value)}
                  required
                />
              </div>
            </OptionalFields>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={createMutation.isPending || !text.trim()}>
                <NotebookPen aria-hidden="true" />
                {createMutation.isPending ? 'Saving…' : 'Add note'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : null}

        {error ? <p className="text-sm text-danger">{error.message}</p> : null}

        {activeNotes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
            No quick notes yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {activeNotes.map((note) => (
              <li
                key={note.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/70 bg-background/30 p-3"
              >
                {editingId === note.id ? (
                  <form
                    className="flex w-full flex-col gap-2 sm:flex-row"
                    onSubmit={(event) => {
                      event.preventDefault()
                      updateMutation.mutate({ id: note.id, version: note.version })
                    }}
                  >
                    <Textarea
                      aria-label="Edit note"
                      value={editingText}
                      maxLength={5000}
                      rows={2}
                      onChange={(event) => setEditingText(event.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        size="sm"
                        variant="secondary"
                        disabled={updateMutation.isPending}
                      >
                        <Save aria-hidden="true" />
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-wrap text-sm">{note.text}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatJournalDate(note.date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(note.id)
                          setEditingText(note.text)
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (window.confirm('Move this note to the trash?')) {
                            deleteMutation.mutate({ id: note.id, version: note.version })
                          }
                        }}
                        aria-label="Move note to trash"
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        {deletedNotes.length > 0 ? (
          <details className="rounded-lg border border-border/60 p-3">
            <summary className="cursor-pointer text-xs text-muted-foreground">
              {deletedNotes.length} deleted note{deletedNotes.length === 1 ? '' : 's'}
            </summary>
            <ul className="mt-3 space-y-2">
              {deletedNotes.map((note) => (
                <li
                  key={note.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/50 p-2"
                >
                  <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground line-through">
                    {note.text}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={restoreMutation.isPending}
                    onClick={() => restoreMutation.mutate({ id: note.id, version: note.version })}
                  >
                    <RotateCcw aria-hidden="true" />
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </CardContent>
    </Card>
  )
}
