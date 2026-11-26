import { dehydrate, hydrate } from '@tanstack/react-query'
import { getCachedQuery, isOfflineUnlocked, putCachedQuery } from './store.js'

export const CACHE_KEY = 'query-cache'

const ALLOWED_QUERY_PREFIXES = new Set([
  'trades',
  'analytics',
  'reference',
  'learning',
  'journal',
  'dashboard',
  'calendar',
  'posters',
  'files',
])

export function isCacheableQuery(query) {
  const prefix = query.queryKey?.[0]
  return (
    ALLOWED_QUERY_PREFIXES.has(prefix) &&
    query.state.status === 'success' &&
    query.state.data !== undefined
  )
}

export async function persistQueryCache(queryClient) {
  if (!isOfflineUnlocked()) return false
  const snapshot = dehydrate(queryClient, { shouldDehydrateQuery: isCacheableQuery })
  if (snapshot.queries.length === 0) return false
  await putCachedQuery(CACHE_KEY, snapshot)
  return true
}

export async function restoreQueryCache(queryClient) {
  if (!isOfflineUnlocked()) return false
  const snapshot = await getCachedQuery(CACHE_KEY)
  if (!snapshot?.queries?.length) return false
  hydrate(queryClient, snapshot)
  return true
}

export function clearQueryCache(queryClient) {
  queryClient.clear()
}
