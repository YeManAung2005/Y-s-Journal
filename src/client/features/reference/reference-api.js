import { apiRequest } from '@/lib/api'

export function fetchReferenceData(includeArchived = false) {
  return apiRequest(`/reference?includeArchived=${includeArchived ? 'true' : 'false'}`)
}

export function createReferenceRecord(kind, payload) {
  return apiRequest(`/reference/${kind}`, { method: 'POST', body: payload })
}

export function updateReferenceRecord(kind, id, payload) {
  return apiRequest(`/reference/${kind}/${id}`, { method: 'PATCH', body: payload })
}

export function referenceAction(kind, id, action) {
  return apiRequest(`/reference/${kind}/${id}/${action}`, { method: 'POST' })
}

export function calculateTrade(payload) {
  return apiRequest('/finance/calculate', { method: 'POST', body: payload })
}
