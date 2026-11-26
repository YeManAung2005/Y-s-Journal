import { apiRequest } from '@/lib/api'

function toQuery(params = {}) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  }
  const serialized = query.toString()
  return serialized ? `?${serialized}` : ''
}

export function fetchLearningCategories(includeArchived = false) {
  return apiRequest(`/learning/categories?includeArchived=${includeArchived ? 'true' : 'false'}`)
}

export function createLearningCategory(payload) {
  return apiRequest('/learning/categories', { method: 'POST', body: payload })
}

export function updateLearningCategory(categoryId, payload) {
  return apiRequest(`/learning/categories/${categoryId}`, { method: 'PATCH', body: payload })
}

export function learningCategoryAction(categoryId, action) {
  return apiRequest(`/learning/categories/${categoryId}/${action}`, { method: 'POST' })
}

export function fetchLearningRecords(params = {}) {
  return apiRequest(`/learning/records${toQuery(params)}`)
}

export function createLearningRecord(payload) {
  return apiRequest('/learning/records', { method: 'POST', body: payload })
}

export function updateLearningRecord(recordId, payload) {
  return apiRequest(`/learning/records/${recordId}`, { method: 'PATCH', body: payload })
}

export function deleteLearningRecord(recordId, expectedVersion) {
  return apiRequest(`/learning/records/${recordId}`, {
    method: 'DELETE',
    body: { expectedVersion },
  })
}

export function restoreLearningRecord(recordId, expectedVersion) {
  return apiRequest(`/learning/records/${recordId}/restore`, {
    method: 'POST',
    body: { expectedVersion },
  })
}

export function uploadLearningAttachments(recordId, files) {
  const formData = new FormData()
  for (const file of files) formData.append('attachments', file)
  return apiRequest(`/learning/records/${recordId}/attachments`, {
    method: 'POST',
    body: formData,
  })
}

export function deleteLearningAttachment(fileId) {
  return apiRequest(`/files/${fileId}`, { method: 'DELETE' })
}

export function fetchLearningGoals(params = {}) {
  return apiRequest(`/learning/goals${toQuery(params)}`)
}

export function createLearningGoal(payload) {
  return apiRequest('/learning/goals', { method: 'POST', body: payload })
}

export function updateLearningGoal(goalId, payload) {
  return apiRequest(`/learning/goals/${goalId}`, { method: 'PATCH', body: payload })
}

export function deleteLearningGoal(goalId, expectedVersion) {
  return apiRequest(`/learning/goals/${goalId}`, {
    method: 'DELETE',
    body: { expectedVersion },
  })
}

export function addLearningMilestone(goalId, payload) {
  return apiRequest(`/learning/goals/${goalId}/milestones`, { method: 'POST', body: payload })
}

export function updateLearningMilestone(goalId, milestoneId, payload) {
  return apiRequest(`/learning/goals/${goalId}/milestones/${milestoneId}`, {
    method: 'PATCH',
    body: payload,
  })
}

export function deleteLearningMilestone(goalId, milestoneId, expectedVersion) {
  return apiRequest(`/learning/goals/${goalId}/milestones/${milestoneId}`, {
    method: 'DELETE',
    body: { expectedVersion },
  })
}

export function addLearningTask(goalId, payload) {
  return apiRequest(`/learning/goals/${goalId}/tasks`, { method: 'POST', body: payload })
}

export function updateLearningTask(goalId, taskId, payload) {
  return apiRequest(`/learning/goals/${goalId}/tasks/${taskId}`, {
    method: 'PATCH',
    body: payload,
  })
}

export function deleteLearningTask(goalId, taskId, expectedVersion) {
  return apiRequest(`/learning/goals/${goalId}/tasks/${taskId}`, {
    method: 'DELETE',
    body: { expectedVersion },
  })
}

export function fetchLearningSummary(params = {}) {
  return apiRequest(`/learning/summary${toQuery(params)}`)
}
