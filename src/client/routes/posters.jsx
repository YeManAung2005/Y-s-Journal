import { createFileRoute } from '@tanstack/react-router'
import { PosterPage } from '@/features/posters/poster-page'

export const Route = createFileRoute('/posters')({
  component: PosterPage,
})
