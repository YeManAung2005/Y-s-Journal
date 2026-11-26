import { apiRequest } from '@/lib/api'

function toQuery(params = {}) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  }
  const serialized = query.toString()
  return serialized ? `?${serialized}` : ''
}

export function fetchAnalyticsSummary(params) {
  return apiRequest(`/analytics/summary${toQuery(params)}`)
}

export function fetchAnalyticsEquity(params) {
  return apiRequest(`/analytics/equity${toQuery(params)}`)
}

export function fetchAnalyticsBreakdowns(params) {
  return apiRequest(`/analytics/breakdowns${toQuery(params)}`)
}

export function fetchAnalyticsComparison(params) {
  return apiRequest(`/analytics/compare${toQuery(params)}`)
}

export function fetchAccountAdjustments(accountId, params = {}) {
  return apiRequest(`/accounts/${accountId}/adjustments${toQuery(params)}`)
}

export function createAccountAdjustment(accountId, payload) {
  return apiRequest(`/accounts/${accountId}/adjustments`, { method: 'POST', body: payload })
}

export function deleteAccountAdjustment(adjustmentId, expectedVersion) {
  return apiRequest(`/account-adjustments/${adjustmentId}`, {
    method: 'DELETE',
    body: { expectedVersion },
  })
}
