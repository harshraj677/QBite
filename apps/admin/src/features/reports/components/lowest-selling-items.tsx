'use client';

import { TrendingDown } from 'lucide-react';
import { WidgetCard } from '@/components/shared/widget-card';
import { formatCompactNumber, formatCurrency } from '@/lib/format';
import { useMenuAnalytics } from '@/features/dashboard/hooks/use-analytics';

/**
 * The Dashboard's `TopSellingItems` has no lowest-selling counterpart
 * — `MenuAnalyticsDto.leastSellingItems` (real, already returned by
 * `GET /analytics/menu`) has simply never been rendered anywhere. This
 * is the same data source and hook as `TopSellingItems`, deliberately
 * without that component's growth-vs-prior-period comparison (a
 * "growth" figure means less for the bottom of a list already sorted
 * by low volume) — a plain, real, no-fabrication ranked list.
 */
export function LowestSellingItems() {
  const { data, isPending, isError, refetch } = useMenuAnalytics('last30days', 8);
  const items = data?.leastSellingItems ?? [];

  return (
    <WidgetCard
      title="Lowest selling items"
      description="Last 30 days, by units sold"
      isLoading={isPending}
      isError={isError}
      onRetry={refetch}
      isEmpty={!isPending && items.length === 0}
      emptyIcon={TrendingDown}
      emptyTitle="No sales yet"
      emptyDescription="Once orders start coming in, slow movers will show up here."
      contentHeight="h-80"
    >
      <ul className="space-y-1">
        {items.map((item, index) => (
          <li
            key={item.itemId}
            className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm ring-1 ring-foreground/10"
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground tabular-nums">
                {index + 1}
              </span>
              <span className="truncate font-medium text-foreground">{item.itemName}</span>
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatCurrency(item.revenue)} · {formatCompactNumber(item.quantitySold)} sold
            </span>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}
