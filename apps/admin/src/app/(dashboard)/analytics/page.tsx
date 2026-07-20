import { BarChart3 } from 'lucide-react';
import { ComingSoonPage } from '@/components/shared/coming-soon';

export const metadata = { title: 'Analytics' };

export default function AnalyticsPage() {
  return (
    <ComingSoonPage
      title="Analytics"
      pageDescription="Revenue, order, menu, canteen, and customer analytics."
      icon={BarChart3}
      emptyStateDescription="Deep-dive charts for revenue trends, order patterns, top-selling items, and customer behavior are coming next — the analytics API behind them is already live."
    />
  );
}
