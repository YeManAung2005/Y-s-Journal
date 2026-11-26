import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Pencil, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OptionalFields } from '@/components/ui/optional-fields'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  addLearningMilestone,
  addLearningTask,
  createLearningGoal,
  deleteLearningGoal,
  deleteLearningMilestone,
  deleteLearningTask,
  updateLearningGoal,
  updateLearningMilestone,
  updateLearningTask,
} from './learning-api'

const EMPTY_GOAL = {
  title: '',
  description: '',
  categoryId: '',
  targetDate: '',
  status: 'active',
}

function invalidateGoals(queryClient) {
  queryClient.invalidateQueries({ queryKey: ['learning', 'goals'] })
  queryClient.invalidateQueries({ queryKey: ['learning', 'records'] })
}

function GoalForm({ goal, categories, onClose }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(() =>
    goal
      ? {
          title: goal.title,
          description: goal.description,
          categoryId: goal.categoryId || '',
          targetDate: goal.targetDate || '',
          status: goal.status,
        }
      : EMPTY_GOAL,
  )

  const availableCategories = categories.filter(
    (category) => !category.archivedAt || category.id === form.categoryId,
  )

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title,
        description: form.description,
        categoryId: form.categoryId || null,
        targetDate: form.targetDate || null,
        status: form.status,
      }
      return goal
        ? updateLearningGoal(goal.id, { ...payload, expectedVersion: goal.version })
        : createLearningGoal(payload)
    },
    onSuccess: () => {
      invalidateGoals(queryClient)
      onClose?.()
    },
  })

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{goal ? 'Edit learning goal' : 'New learning goal'}</CardTitle>
        <CardDescription>
          Milestones and tasks are added after the goal is saved. Progress is calculated from them.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            mutation.mutate()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="learning-goal-title">Title</Label>
            <Input
              id="learning-goal-title"
              value={form.title}
              maxLength={160}
              onChange={(event) => setField('title', event.target.value)}
              placeholder="Complete the React course"
              required
            />
          </div>

          <OptionalFields>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="learning-goal-category">Category</Label>
                <Select
                  id="learning-goal-category"
                  value={form.categoryId}
                  onChange={(event) => setField('categoryId', event.target.value)}
                >
                  <option value="">No category</option>
                  {availableCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                      {category.archivedAt ? ' (archived)' : ''}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="learning-goal-target">Target date</Label>
                <Input
                  id="learning-goal-target"
                  type="date"
                  value={form.targetDate}
                  onChange={(event) => setField('targetDate', event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="learning-goal-status">Status</Label>
                <Select
                  id="learning-goal-status"
                  value={form.status}
                  onChange={(event) => setField('status', event.target.value)}
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="learning-goal-description">Description</Label>
              <Textarea
                id="learning-goal-description"
                value={form.description}
                maxLength={5000}
                rows={3}
                onChange={(event) => setField('description', event.target.value)}
                placeholder="Why this goal matters and what finished looks like"
              />
            </div>
          </OptionalFields>

          {mutation.error ? <p className="text-sm text-danger">{mutation.error.message}</p> : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={mutation.isPending}>
              <Save aria-hidden="true" />
              {mutation.isPending ? 'Saving…' : goal ? 'Save goal' : 'Create goal'}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function GoalItem({ title, detail, completed, disabled, onToggle, onDelete }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border/60 bg-background/30 px-3 py-2">
      <input
        type="checkbox"
        className="size-4"
        checked={completed}
        onChange={onToggle}
        disabled={disabled}
        aria-label={`Mark ${title} ${completed ? 'incomplete' : 'complete'}`}
      />
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${completed ? 'text-muted-foreground line-through' : ''}`}>
          {title}
        </p>
        {detail ? <p className="text-[11px] text-muted-foreground">{detail}</p> : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onDelete}
        disabled={disabled}
        aria-label={`Delete ${title}`}
      >
        <Trash2 aria-hidden="true" />
      </Button>
    </div>
  )
}

function GoalCard({ goal, onEdit }) {
  const queryClient = useQueryClient()
  const [milestoneTitle, setMilestoneTitle] = useState('')
  const [milestoneDate, setMilestoneDate] = useState('')
  const [taskTitle, setTaskTitle] = useState('')

  const actionMutation = useMutation({
    mutationFn: (action) => action(),
    onSuccess: () => {
      setMilestoneTitle('')
      setMilestoneDate('')
      setTaskTitle('')
      invalidateGoals(queryClient)
    },
  })

  const pending = actionMutation.isPending

  function addMilestone(event) {
    event.preventDefault()
    if (!milestoneTitle.trim()) return
    actionMutation.mutate(() =>
      addLearningMilestone(goal.id, {
        title: milestoneTitle.trim(),
        dueDate: milestoneDate || null,
        expectedVersion: goal.version,
      }),
    )
  }

  function addTask(event) {
    event.preventDefault()
    if (!taskTitle.trim()) return
    actionMutation.mutate(() =>
      addLearningTask(goal.id, {
        title: taskTitle.trim(),
        expectedVersion: goal.version,
      }),
    )
  }

  function deleteGoal() {
    if (window.confirm('Move this learning goal to the trash?')) {
      actionMutation.mutate(() => deleteLearningGoal(goal.id, goal.version))
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border/70 bg-background/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">{goal.title}</h3>
            <Badge variant={goal.status === 'completed' ? 'success' : 'secondary'}>
              {goal.status}
            </Badge>
            {goal.categorySnapshot ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: goal.categorySnapshot.color }}
                  aria-hidden="true"
                />
                {goal.categorySnapshot.name}
              </span>
            ) : null}
          </div>
          {goal.description ? (
            <p className="max-w-3xl text-sm text-muted-foreground">{goal.description}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {goal.targetDate ? `Target ${goal.targetDate}` : 'No target date'} · Version{' '}
            {goal.version}
            {goal.completedAt ? ' · Completed' : ''}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" size="sm" variant="ghost" onClick={() => onEdit(goal)}>
            <Pencil aria-hidden="true" />
            Edit
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              actionMutation.mutate(() =>
                updateLearningGoal(goal.id, {
                  status: goal.status === 'completed' ? 'active' : 'completed',
                  expectedVersion: goal.version,
                }),
              )
            }
          >
            {goal.status === 'completed' ? (
              <RotateCcw aria-hidden="true" />
            ) : (
              <Check aria-hidden="true" />
            )}
            {goal.status === 'completed' ? 'Reopen' : 'Complete'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={deleteGoal}
            aria-label="Move goal to trash"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {goal.completedMilestoneCount + goal.completedTaskCount} of{' '}
            {goal.milestones.length + goal.tasks.length} items complete
          </span>
          <span className="font-mono">{goal.progressPercent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${goal.progressPercent}%` }}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Milestones
          </p>
          {goal.milestones.length === 0 ? (
            <p className="text-xs text-muted-foreground">No milestones yet.</p>
          ) : (
            <div className="space-y-2">
              {goal.milestones.map((milestone) => (
                <GoalItem
                  key={milestone.id}
                  title={milestone.title}
                  detail={milestone.dueDate ? `Due ${milestone.dueDate}` : ''}
                  completed={milestone.completed}
                  disabled={pending}
                  onToggle={() =>
                    actionMutation.mutate(() =>
                      updateLearningMilestone(goal.id, milestone.id, {
                        completed: !milestone.completed,
                        expectedVersion: goal.version,
                      }),
                    )
                  }
                  onDelete={() =>
                    actionMutation.mutate(() =>
                      deleteLearningMilestone(goal.id, milestone.id, goal.version),
                    )
                  }
                />
              ))}
            </div>
          )}
          <form className="space-y-2" onSubmit={addMilestone}>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input
                aria-label="New milestone title"
                value={milestoneTitle}
                maxLength={200}
                placeholder="Add a milestone"
                onChange={(event) => setMilestoneTitle(event.target.value)}
              />
              <Button type="submit" size="sm" variant="outline" disabled={pending}>
                <Plus aria-hidden="true" />
                Add
              </Button>
            </div>
            <OptionalFields>
              <Input
                aria-label="New milestone due date"
                type="date"
                value={milestoneDate}
                onChange={(event) => setMilestoneDate(event.target.value)}
              />
            </OptionalFields>
          </form>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tasks
          </p>
          {goal.tasks.length === 0 ? (
            <p className="text-xs text-muted-foreground">No tasks yet.</p>
          ) : (
            <div className="space-y-2">
              {goal.tasks.map((task) => (
                <GoalItem
                  key={task.id}
                  title={task.title}
                  completed={task.completed}
                  disabled={pending}
                  onToggle={() =>
                    actionMutation.mutate(() =>
                      updateLearningTask(goal.id, task.id, {
                        completed: !task.completed,
                        expectedVersion: goal.version,
                      }),
                    )
                  }
                  onDelete={() =>
                    actionMutation.mutate(() => deleteLearningTask(goal.id, task.id, goal.version))
                  }
                />
              ))}
            </div>
          )}
          <form className="flex gap-2" onSubmit={addTask}>
            <Input
              aria-label="New task title"
              value={taskTitle}
              maxLength={200}
              placeholder="Add a task"
              onChange={(event) => setTaskTitle(event.target.value)}
            />
            <Button type="submit" size="sm" variant="outline" disabled={pending}>
              <Plus aria-hidden="true" />
              Add
            </Button>
          </form>
        </div>
      </div>

      {actionMutation.error ? (
        <p className="text-sm text-danger">{actionMutation.error.message}</p>
      ) : null}
    </div>
  )
}

export function LearningGoalsSection({ goals, categories }) {
  const [showForm, setShowForm] = useState(false)
  const [editingGoal, setEditingGoal] = useState(null)

  const activeGoals = goals.filter((goal) => !goal.deletedAt)
  const completed = activeGoals.filter((goal) => goal.status === 'completed').length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Goals and milestones</h2>
          <p className="text-xs text-muted-foreground">
            {activeGoals.length} goal{activeGoals.length === 1 ? '' : 's'} · {completed} completed
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setEditingGoal(null)
            setShowForm((value) => !value)
          }}
        >
          <Plus aria-hidden="true" />
          {showForm ? 'Hide goal form' : 'New goal'}
        </Button>
      </div>

      {showForm ? <GoalForm categories={categories} onClose={() => setShowForm(false)} /> : null}

      {activeGoals.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
          No learning goals yet. Add one to break a longer study plan into milestones and tasks.
        </p>
      ) : (
        <div className="space-y-4">
          {activeGoals.map((goal) =>
            editingGoal?.id === goal.id ? (
              <GoalForm
                key={goal.id}
                goal={goal}
                categories={categories}
                onClose={() => setEditingGoal(null)}
              />
            ) : (
              <GoalCard key={goal.id} goal={goal} onEdit={setEditingGoal} />
            ),
          )}
        </div>
      )}
    </div>
  )
}
