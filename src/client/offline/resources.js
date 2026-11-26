const RESOURCE_PATTERNS = [
  [/^\/trades\/([^/]+)$/, 'trades'],
  [/^\/reference\/instruments\/([^/]+)$/, 'instruments'],
  [/^\/reference\/accounts\/([^/]+)$/, 'accounts'],
  [/^\/reference\/tags\/([^/]+)$/, 'tags'],
  [/^\/reference\/trading-sessions\/([^/]+)$/, 'sessions'],
  [/^\/reference\/checklist\/([^/]+)$/, 'checklist'],
  [/^\/account-adjustments\/([^/]+)$/, 'adjustments'],
  [/^\/journal\/entries\/([^/]+)$/, 'journalEntries'],
  [/^\/journal\/notes\/([^/]+)$/, 'quickNotes'],
  [/^\/learning\/categories\/([^/]+)$/, 'learningCategories'],
  [/^\/learning\/records\/([^/]+)$/, 'learningRecords'],
  [/^\/learning\/goals\/([^/]+)$/, 'learningGoals'],
  [/^\/dashboard\/layouts\/([^/]+)$/, 'dashboardLayouts'],
  [/^\/posters\/configs\/([^/]+)$/, 'posterConfigs'],
  [/^\/files\/([^/]+)$/, 'files'],
]

export function resourceForPath(path) {
  for (const [pattern, type] of RESOURCE_PATTERNS) {
    const match = path.match(pattern)
    if (match) return { type, id: match[1] }
  }
  return null
}
