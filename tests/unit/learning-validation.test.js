import { describe, expect, it } from 'vitest'
import {
  learningCategoryCreateSchema,
  learningGoalCreateSchema,
  learningRecordCreateSchema,
  learningRecordPatchSchema,
  milestonePatchSchema,
  taskPatchSchema,
} from '../../src/shared/validation/learning.js'

const categoryId = '64b000000000000000000001'

describe('learning validation', () => {
  it('normalizes record defaults and keeps optional links nullable', () => {
    const parsed = learningRecordCreateSchema.parse({
      date: '2026-11-25',
      categoryId,
      topic: '  Market structure  ',
      goalId: null,
    })

    expect(parsed).toMatchObject({
      topic: 'Market structure',
      keyTakeaways: '',
      durationMinutes: 0,
      notes: '',
      resources: [],
      goalId: null,
    })
  })

  it('rejects unsafe resource URLs and duplicate-free patch fields', () => {
    expect(() =>
      learningRecordCreateSchema.parse({
        date: '2026-11-25',
        categoryId,
        topic: 'Risk',
        resources: [{ label: 'Local file', url: 'file:///C:/secret.txt' }],
      }),
    ).toThrow()

    expect(() =>
      learningRecordPatchSchema.parse({
        expectedVersion: 0,
      }),
    ).toThrow()
  })

  it('validates category colors and goal category links', () => {
    expect(() => learningCategoryCreateSchema.parse({ name: 'Books', color: 'purple' })).toThrow()

    const goal = learningGoalCreateSchema.parse({
      title: 'Complete the course',
      categoryId,
      targetDate: null,
    })
    expect(goal).toMatchObject({
      status: 'active',
      description: '',
      targetDate: null,
    })
  })

  it('requires versioned nested milestone and task updates', () => {
    expect(() => milestonePatchSchema.parse({ expectedVersion: 2, title: 'Updated' })).not.toThrow()
    expect(() => milestonePatchSchema.parse({ expectedVersion: 2 })).toThrow()
    expect(() => taskPatchSchema.parse({ expectedVersion: 2, completed: true })).not.toThrow()
    expect(() => taskPatchSchema.parse({ expectedVersion: 2 })).toThrow()
  })
})
