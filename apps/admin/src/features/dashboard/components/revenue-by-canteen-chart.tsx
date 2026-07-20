'use client';

import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { Store } from 'lucide-react';
import { WidgetCard } from '@/components/shared/widget-card';
import { CHART_GRID_COLOR, CHART_TEXT_COLOR } from '@/lib/chart-colors';
import { formatCurrency } from '@/lib/format';
import { useCanteenAnalytics } from '../hooks/use-analytics';

function ChartTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { canteenName: string; revenue: number; orderCount: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-popover-foreground">{point.canteenName}</p>
      <p className="mt-1 text-muted-foreground">
        Revenue <span className="font-semibold text-foreground">{formatCurrency(point.revenue)}</span>
      </p>
      <p className="text-muted-foreground">
        Orders <span className="font-semibold text-foreground">{point.orderCount}</span>
      </p>
    </div>
  );
}

/** Horizontal bars — canteen names are free-text and can run long, so a vertical-bar x-axis would clip or rotate labels illegibly; horizontal keeps every name on one readable line regardless of length. */
export function RevenueByCanteenChart() {
  const { data, isPending, isError, refetch } = useCanteenAnalytics('last30days', 8);
  const chartData = useMemo(
    () => [...(data?.byCanteen ?? [])].sort((a, b) => b.revenue - a.revenue).slice(0, 8),
    [data],
  );
  const chartHeight = Math.max(chartData.length * 40, 160);

  return (
    <WidgetCard
      title="Revenue by canteen"
      description="Last 30 days"
      isLoading={isPending}
      isError={isError}
      onRetry={refetch}
      isEmpty={!isPending && chartData.length === 0}
      emptyIcon={Store}
      emptyTitle="No canteen revenue yet"
      contentHeight="h-72"
    >
      <ResponsiveContainer width="100%" height={Math.max(chartHeight, 288)}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 8, right: 24, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} horizontal={false} />
          <XAxis
            type="number"
            stroke={CHART_TEXT_COLOR}
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => formatCurrency(value).replace('.00', '')}
          />
          <YAxis
            type="category"
            dataKey="canteenName"
            stroke={CHART_TEXT_COLOR}
            fontSize={12}
            tickLine={false}
            axisLine={false}
            width={110}
            tick={{ width: 100 }}
          />
          <RechartsTooltip content={<ChartTooltipContent />} cursor={{ fill: 'var(--muted)' }} />
          <Bar dataKey="revenue" fill="var(--chart-3)" radius={[0, 4, 4, 0]} animationDuration={500} />
        </BarChart>
      </ResponsiveContainer>
    </WidgetCard>
  );
}
