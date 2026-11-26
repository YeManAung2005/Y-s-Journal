import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, NotebookPen, Pencil, RotateCcw, Search, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth-context'
import { formatJournalDate, timeInTimeZone, todayInTimeZone } from '@/lib/date'
import {
  deleteJournalEntry,
  fetchJournalEntries,
  fetchQuickNotes,
  restoreJournalEntry,
  searchJournal,
} from './journal-api'
import { JournalEntryForm } from './journal-entry-form'
import { QuickNotesSection } from './quick-notes-section'

function previewOf(entry) {
  const source = entry.highlights || entry.freeWriting || entry.reflection || entry.lessons || ''
  if (!source) return 'No written content yet.'
  return source.length > 140 ? `${source.slice(0, 140)}…` : source
}

function moodLabel(mood) {
  if (!mood) return null
  return { 1: 'Rough', 2: 'Low', 3: 'Okay', 4: 'Good', 5: 'Great' }[mood] ?? null
}

export function JournalPage() {
  const { settings } = useAuth()
  const queryClient = useQueryClient()
  const timeZone = settings?.appTimeZone ?? 'Asia/Yangon'
  const today = todayInTimeZone(timeZone)

  const [editorTarget, setEditorTarget] = useState(null)
  const [saveNotice, setSaveNotice] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searchError, setSearchError] = useState(null)
  const [reminderDismissed, setReminderDismissed] = useState(false)
  const formRef = useRef(null)
  const shouldScrollRef = useRef(false)

  const entriesQuery = useQuery({
    queryKey: ['journal', 'entries'],
    queryFn: () => fetchJournalEntries({ limit: 60, includeDeleted: true }),
  })
  const notesQuery = useQuery({
    queryKey: ['journal', 'notes'],
    queryFn: () => fetchQuickNotes({ limit: 60, includeDeleted: true }),
  })

  const deleteMutation = useMutation({
    mutationFn: ({ id, version }) => deleteJournalEntry(id, version),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['journal'] }),
  })
  const restoreMutation = useMutation({
    mutationFn: ({ id, version }) => restoreJournalEntry(id, version),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['journal'] }),
  })

  const searchMutation = useMutation({
    mutationFn: (term) => searchJournal({ q: term }),
    onSuccess: (data) => {
      setSearchResults(data)
      setSearchError(null)
    },
    onError: (error) => setSearchError(error.message),
  })

  const todayEntry =
    entriesQuery.data?.entries?.find((entry) => entry.date === today && !entry.deletedAt) ?? null
  const editor = editorTarget

  useEffect(() => {
    if (editor && shouldScrollRef.current) {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      shouldScrollRef.current = false
    }
  }, [editor])

  if (entriesQuery.isPending || notesQuery.isPending) {
    return <p className="text-sm text-muted-foreground">Loading your journal…</p>
  }

  const failed = [entriesQuery, notesQuery].find((query) => query.isError)
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

  const entries = entriesQuery.data.entries
  const notes = notesQuery.data.notes
  const activeEntries = entries.filter((entry) => !entry.deletedAt)
  const deletedEntries = entries.filter((entry) => entry.deletedAt)

  const reminders = settings?.reminders ?? {}
  const reminderEnabled = Boolean(reminders.journalEnabled)
  const reminderTime = reminders.journalTime ?? '20:00'
  const nowTime = timeInTimeZone(timeZone)
  const reminderDue = reminderEnabled && nowTime >= reminderTime && !todayEntry

  function submitSearch(event) {
    event.preventDefault()
    const term = searchTerm.trim()
    if (!term) {
      setActiveSearch('')
      setSearchResults(null)
      return
    }
    setActiveSearch(term)
    searchMutation.mutate(term)
  }

  function deleteEntry(entry) {
    if (window.confirm('Move this journal entry to the trash?')) {
      deleteMutation.mutate({ id: entry.id, version: entry.version })
    }
  }

  function openEditor(target) {
    shouldScrollRef.current = true
    setEditorTarget(target)
    setSaveNotice(null)
  }

  function closeEditor() {
    setEditorTarget(null)
  }

  function handleSaved(savedEntry) {
    setEditorTarget(null)
    setSaveNotice(`Saved the entry for ${formatJournalDate(savedEntry?.date ?? today)}.`)
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
          <NotebookPen className="size-3.5" aria-hidden="true" />
          Daily Journal
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Personal journal</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          One private entry per day, quick notes for anything on your mind, and private search
          across your writing. Journal content is never included in trading analytics, learning
          data, dashboards, or posters.
        </p>
      </header>

      {reminderDue && !reminderDismissed ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4"
        >
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 size-4 text-warning" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">Journal reminder</p>
              <p className="text-xs text-muted-foreground">
                It is {nowTime} in {timeZone}. Take a few minutes for today&apos;s entry.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setReminderDismissed(true)}
          >
            Dismiss
          </Button>
        </div>
      ) : null}

      <div ref={formRef} className="scroll-mt-6">
        {saveNotice ? (
          <div
            role="status"
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-success/30 bg-success/10 p-4"
          >
            <p className="text-sm font-medium">{saveNotice}</p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() =>
                openEditor(todayEntry ? { mode: 'edit', entry: todayEntry } : { mode: 'new' })
              }
            >
              {todayEntry ? 'Edit today’s entry' : 'Write today’s entry'}
            </Button>
          </div>
        ) : null}

        {editor ? (
          <JournalEntryForm
            key={editor.mode === 'edit' ? editor.entry.id : `today-${today}`}
            entry={editor.mode === 'edit' ? editor.entry : null}
            date={editor.mode === 'edit' ? editor.entry.date : today}
            onSaved={handleSaved}
            onCancel={closeEditor}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>
                {todayEntry ? 'Today’s entry is saved' : 'No entry for today yet'}
              </CardTitle>
              <CardDescription>
                {todayEntry
                  ? 'Your writing is private. Reopen the form whenever you want to edit it.'
                  : 'Start a private entry for today, or add a quick note below.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                onClick={() =>
                  openEditor(todayEntry ? { mode: 'edit', entry: todayEntry } : { mode: 'new' })
                }
              >
                <Pencil aria-hidden="true" />
                {todayEntry ? 'Edit today’s entry' : 'Write today’s entry'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <QuickNotesSection notes={notes} date={today} />

      <Card>
        <CardHeader>
          <CardTitle>Search your journal</CardTitle>
          <CardDescription>
            Search runs only against your own entries and quick notes on this device.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={submitSearch}>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="journal-search">Search text</Label>
              <Input
                id="journal-search"
                value={searchTerm}
                maxLength={200}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="A word, phrase, or idea"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit" disabled={searchMutation.isPending}>
                <Search aria-hidden="true" />
                {searchMutation.isPending ? 'Searching…' : 'Search'}
              </Button>
              {activeSearch ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setSearchTerm('')
                    setActiveSearch('')
                    setSearchResults(null)
                    setSearchError(null)
                  }}
                >
                  Clear
                </Button>
              ) : null}
            </div>
          </form>

          {searchError ? <p className="text-sm text-danger">{searchError}</p> : null}

          {searchResults ? (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                {searchResults.entries.length} entr
                {searchResults.entries.length === 1 ? 'y' : 'ies'} and {searchResults.notes.length}{' '}
                note{searchResults.notes.length === 1 ? '' : 's'} matched “{activeSearch}”.
              </p>

              {searchResults.entries.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-lg border border-border/70 bg-background/30 p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {entry.date}
                        </span>
                        {moodLabel(entry.mood) ? (
                          <Badge variant="outline">{moodLabel(entry.mood)}</Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm">{previewOf(entry)}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {searchResults.notes.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.notes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-lg border border-border/70 bg-background/30 p-3"
                    >
                      <span className="font-mono text-xs text-muted-foreground">{note.date}</span>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{note.text}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent entries</CardTitle>
          <CardDescription>
            {activeEntries.length} active entr{activeEntries.length === 1 ? 'y' : 'ies'}. One entry
            is kept per day.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeEntries.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
              No journal entries yet. Write your first entry above.
            </p>
          ) : (
            activeEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/70 bg-background/30 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{entry.date}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatJournalDate(entry.date)}
                    </span>
                    {moodLabel(entry.mood) ? (
                      <Badge variant="outline">{moodLabel(entry.mood)}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                    {previewOf(entry)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditor({ mode: 'edit', entry })}
                  >
                    <Pencil aria-hidden="true" />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteEntry(entry)}
                    aria-label="Move entry to trash"
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ))
          )}

          {deletedEntries.length > 0 ? (
            <details className="rounded-lg border border-border/60 p-3">
              <summary className="cursor-pointer text-xs text-muted-foreground">
                {deletedEntries.length} deleted entr{deletedEntries.length === 1 ? 'y' : 'ies'}
              </summary>
              <ul className="mt-3 space-y-2">
                {deletedEntries.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/50 p-2"
                  >
                    <span className="font-mono text-xs text-muted-foreground">{entry.date}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={restoreMutation.isPending}
                      onClick={() =>
                        restoreMutation.mutate({ id: entry.id, version: entry.version })
                      }
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
    </div>
  )
}
