'use client';

import { motion } from 'motion/react';
import { ChefHat } from 'lucide-react';
import { useMemo } from 'react';
import { WidgetCard } from '@/components/shared/widget-card';
import { formatCompactNumber } from '@/lib/format';
import { useDashboardOverview } from '../hooks/use-dashboard-overview';
import { ORDER_STATUS_CHART_COLOR, ORDER_STATUS_LABELS, ORDER_STATUS_ORDER } from '@/lib/order-status';

/**
 * All-time order-status distribution (from the same
 * `GET /analytics/dashboard` call the metric cards already use — no
 * extra request), deliberately not the `last30days` window the Orders
 * by Status donut above uses. The donut answers "how is the last
 * month trending"; this answers "of everything ever ordered, how much
 * made it all the way through" — a health metric, not a duplicate.
 */
export function KitchenStatusWidget() {
  const { data, isPending, isError, refetch } = useDashboardOverview();

  const rows = useMemo(() => {
    if (!data) return [];
    const total = data.orders.total || 1;
    return ORDER_STATUS_ORDER.map((status) => ({
      status,
      label: ORDER_STATUS_LABELS[status],
      count: data.orders.byStatus[status] ?? 0,
      percent: ((data.orders.byStatus[status] ?? 0) / total) * 100,
    }));
  }, [data]);

  return (
    <WidgetCard
      title="Kitchen status"
      description="All-time order distribution"
      isLoading={isPending}
      isError={isError}
      onRetry={refetch}
      isEmpty={!isPending && (data?.orders.total ?? 0) === 0}
      emptyIcon={ChefHat}
      emptyTitle="No orders yet"
      contentHeight="h-64"
    >
      <div className="space-y-4">
        {rows.map((row, index) => (
          <div key={row.status} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">{row.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {formatCompactNumber(row.count)}
                <span className="ml-1.5 text-xs">({Math.round(row.percent)}%)</span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: ORDER_STATUS_CHART_COLOR[row.status] }}
                initial={{ width: 0 }}
                animate={{ width: `${row.percent}%` }}
                transition={{ duration: 0.6, delay: index * 0.05, ease: 'easeOut' }}
              />
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}
