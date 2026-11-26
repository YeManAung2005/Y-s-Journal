import { apiRequest } from '@/lib/api'

export function fetchDashboardData(layoutId) {
  const query = layoutId ? `?layoutId=${encodeURIComponent(layoutId)}` : ''
  return apiRequest(`/dashboard/data${query}`)
}

export function fetchDashboardLayouts() {
  return apiRequest('/dashboard/layouts')
}

export function fetchWidgetCatalog() {
  return apiRequest('/dashboard/widgets')
}

export function createDashboardLayout(payload) {
  return apiRequest('/dashboard/layouts', { method: 'POST', body: payload })
}

export function updateDashboardLayout(layoutId, payload) {
  return apiRequest(`/dashboard/layouts/${layoutId}`, { method: 'PATCH', body: payload })
}

export function deleteDashboardLayout(layoutId, expectedVersion) {
  return apiRequest(`/dashboard/layouts/${layoutId}`, {
    method: 'DELETE',
    body: { expectedVersion },
  })
}

export function setDefaultDashboardLayout(layoutId, expectedVersion) {
  return apiRequest(`/dashboard/layouts/${layoutId}/default`, {
    method: 'POST',
    body: { expectedVersion },
  })
}
