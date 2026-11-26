import { createFileRoute, Outlet, useRouterState } from '@tanstack/react-router'
import { TradesPage } from '@/features/trades/trades-page'

function TradesRouteComponent() {
  const isDetail = useRouterState({
    select: (state) => state.location.pathname.startsWith('/trades/'),
  })
  return isDetail ? <Outlet /> : <TradesPage />
}

export const Route = createFileRoute('/trades')({
  component: TradesRouteComponent,
})
