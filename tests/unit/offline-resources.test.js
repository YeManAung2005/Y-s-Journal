import { describe, expect, it } from 'vitest'
import { resourceForPath } from '../../src/client/offline/resources.js'

describe('offline conflict resource mapping', () => {
  it('maps owner-scoped record paths to sync resource types', () => {
    expect(resourceForPath('/trades/abc123')).toEqual({ type: 'trades', id: 'abc123' })
    expect(resourceForPath('/journal/entries/xyz')).toEqual({ type: 'journalEntries', id: 'xyz' })
    expect(resourceForPath('/learning/goals/goal-1')).toEqual({
      type: 'learningGoals',
      id: 'goal-1',
    })
    expect(resourceForPath('/posters/configs/config-1')).toEqual({
      type: 'posterConfigs',
      id: 'config-1',
    })
  })

  it('returns null for paths that cannot be compared with the server', () => {
    expect(resourceForPath('/auth/unlock')).toBeNull()
    expect(resourceForPath('/trades')).toBeNull()
    expect(resourceForPath('/settings')).toBeNull()
  })
})
