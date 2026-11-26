import { createFileRoute } from '@tanstack/react-router'
import { ReferenceDataPage } from '@/features/reference/reference-data-page'

export const Route = createFileRoute('/setup')({
  component: ReferenceDataPage,
})
