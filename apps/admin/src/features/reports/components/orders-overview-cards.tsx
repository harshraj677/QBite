'use client';

import { CheckCircle2, IndianRupee, ShoppingBag } from 'lucide-react';
import { StatCard } from '@/components/shared/stat-card';
import { formatCompactNumber, formatCurrency } from '@/lib/format';
import { useOrderAnalytics, useRevenueAnalytics } from '@/features/dashboard/hooks/use-analytics';

/**
 * "Total Orders" and "Average Order Value" for this phase's Orders
 * section — both real fields already returned by `GET /analytics/revenue`
 * (`totalOrderCount`/`averageOrderValue`), just never surfaced as their
 * own cards anywhere (the Dashboard's metric grid shows all-time total
 * orders, not the same last-30-days figure this endpoint scopes to).
 * "Completion Rate" reuses `GET /analytics/orders`' existing field —
 * same two hooks `MetricCardsGrid`/`OrdersByStatusChart` already call,
 * deduped by TanStack Query's queryKey, not a third fetch.
 */
export function OrdersOverviewCards() {
  const revenue = useRevenueAnalytics('last30days', 'day');
  const orders = useOrderAnalytics('last30days');
  const isLoading = revenue.isPending || orders.isPending;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard
        label="Total orders"
        icon={ShoppingBag}
        loading={isLoading}
        value={revenue.data ? formatCompactNumber(revenue.data.totalOrderCount) : '—'}
        tooltip="Every order placed in the last 30 days, any status."
      />
      <StatCard
        label="Average order value"
        icon={IndianRupee}
        loading={isLoading}
        value={revenue.data ? formatCurrency(revenue.data.averageOrderValue) : '—'}
        tooltip="Total revenue divided by paid order count, last 30 days."
      />
      <StatCard
        label="Completion rate"
        icon={CheckCircle2}
        loading={isLoading}
        value={orders.data ? `${orders.data.completionRate}%` : '—'}
        tooltip="Share of orders that reached Completed, last 30 days."
      />
    </div>
  );
}
