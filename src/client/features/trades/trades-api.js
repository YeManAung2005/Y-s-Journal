import { apiRequest } from '@/lib/api'

function toQuery(params = {}) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  }
  const serialized = query.toString()
  return serialized ? `?${serialized}` : ''
}

export function fetchTrades(params) {
  return apiRequest(`/trades${toQuery(params)}`)
}

export function fetchTrade(tradeId) {
  return apiRequest(`/trades/${tradeId}`)
}

export function createTrade(payload) {
  return apiRequest('/trades', { method: 'POST', body: payload })
}

export function updateTrade(tradeId, payload) {
  return apiRequest(`/trades/${tradeId}`, { method: 'PATCH', body: payload })
}

export function deleteTrade(tradeId, expectedVersion) {
  return apiRequest(`/trades/${tradeId}`, {
    method: 'DELETE',
    body: { expectedVersion },
  })
}

export function restoreTrade(tradeId, expectedVersion) {
  return apiRequest(`/trades/${tradeId}/restore`, {
    method: 'POST',
    body: { expectedVersion },
  })
}

export function uploadScreenshots(tradeId, files) {
  const formData = new FormData()
  for (const file of files) formData.append('screenshots', file)
  return apiRequest(`/trades/${tradeId}/screenshots`, { method: 'POST', body: formData })
}
