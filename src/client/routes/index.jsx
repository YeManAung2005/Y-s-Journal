import { createFileRoute } from '@tanstack/react-router'
import { FoundationPage } from '@/features/foundation/foundation-page'

export const Route = createFileRoute('/')({
  component: FoundationPage,
})
