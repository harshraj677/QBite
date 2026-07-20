'use client';

import { useMemo } from 'react';
import { Store } from 'lucide-react';
import { WidgetCard } from '@/components/shared/widget-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCompactNumber, formatCurrency } from '@/lib/format';
import { useCanteenAnalytics } from '@/features/dashboard/hooks/use-analytics';

/**
 * A ranked, scannable complement to the Dashboard's `RevenueByCanteenChart`
 * bar chart — same `useCanteenAnalytics` hook and queryKey (deduped by
 * TanStack Query, not a second request), just as a table so Revenue
 * and Orders can be compared side by side per canteen instead of read
 * off a tooltip one canteen at a time.
 */
export function CanteenPerformanceTable() {
  const { data, isPending, isError, refetch } = useCanteenAnalytics('last30days', 20);
  const rows = useMemo(
    () => [...(data?.byCanteen ?? [])].sort((a, b) => b.revenue - a.revenue),
    [data],
  );

  return (
    <WidgetCard
      title="Canteen performance"
      description="Last 30 days, ranked by revenue"
      isLoading={isPending}
      isError={isError}
      onRetry={refetch}
      isEmpty={!isPending && rows.length === 0}
      emptyIcon={Store}
      emptyTitle="No canteen activity yet"
      contentHeight="h-72"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>Canteen</TableHead>
            <TableHead className="text-right">Revenue</TableHead>
            <TableHead className="text-right">Orders</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={row.canteenId}>
              <TableCell className="tabular-nums text-muted-foreground">{index + 1}</TableCell>
              <TableCell className="font-medium text-foreground">{row.canteenName}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(row.revenue)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCompactNumber(row.orderCount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </WidgetCard>
  );
}
