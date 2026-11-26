import { apiRequest } from '@/lib/api'

export function fetchCalendarMonth(month) {
  return apiRequest(`/calendar/month?month=${encodeURIComponent(month)}`)
}
