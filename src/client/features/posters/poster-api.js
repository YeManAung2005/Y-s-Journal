import { apiRequest } from '@/lib/api'

export function fetchPosterCatalog() {
  return apiRequest('/posters/catalog')
}

export function fetchPosterConfigs() {
  return apiRequest('/posters/configs')
}

export function fetchPosterData({ type, days, basis, tradeId }) {
  const query = new URLSearchParams({ type, days: String(days), basis })
  if (tradeId) query.set('tradeId', tradeId)
  return apiRequest(`/posters/data?${query.toString()}`)
}

export function createPosterConfig(payload) {
  return apiRequest('/posters/configs', { method: 'POST', body: payload })
}

export function updatePosterConfig(configId, payload) {
  return apiRequest(`/posters/configs/${configId}`, { method: 'PATCH', body: payload })
}

export function deletePosterConfig(configId, expectedVersion) {
  return apiRequest(`/posters/configs/${configId}`, {
    method: 'DELETE',
    body: { expectedVersion },
  })
}
