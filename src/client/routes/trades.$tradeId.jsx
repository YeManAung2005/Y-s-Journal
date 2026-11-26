import { createFileRoute } from '@tanstack/react-router'
import { TradeDetailPage } from '@/features/trades/trade-detail-page'

export const Route = createFileRoute('/trades/$tradeId')({
  component: TradeDetailPage,
})
