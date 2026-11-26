import { createFileRoute } from '@tanstack/react-router'
import { LearningPage } from '@/features/learning/learning-page'

export const Route = createFileRoute('/learning')({
  component: LearningPage,
})
