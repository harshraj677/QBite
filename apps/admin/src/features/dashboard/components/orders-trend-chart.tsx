'use client';

import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { ShoppingBag } from 'lucide-react';
import { WidgetCard } from '@/components/shared/widget-card';
import { CHART_GRID_COLOR, CHART_TEXT_COLOR } from '@/lib/chart-colors';
import { formatChartDate } from '@/lib/format';
import { useOrderAnalytics } from '../hooks/use-analytics';

function ChartTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { date: string; count: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-popover-foreground">{formatChartDate(point.date, 'day')}</p>
      <p className="mt-1 text-muted-foreground">
        Orders <span className="font-semibold text-foreground">{point.count}</span>
      </p>
    </div>
  );
}

/** Daily order volume, last 30 days — same window the metric cards' "Total orders" trend and completion-rate figures use, so every "last 30 days" number on the page is drawn from the same underlying request. */
export function OrdersTrendChart() {
  const { data, isPending, isError, refetch } = useOrderAnalytics('last30days');
  const chartData = useMemo(() => data?.byDay ?? [], [data]);

  return (
    <WidgetCard
      title="Orders trend"
      description="Last 30 days"
      isLoading={isPending}
      isError={isError}
      onRetry={refetch}
      isEmpty={!isPending && chartData.length === 0}
      emptyIcon={ShoppingBag}
      emptyTitle="No orders in this window"
      contentHeight="h-72"
    >
      <ResponsiveContainer width="100%" height={288}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) => formatChartDate(value, 'day')}
            stroke={CHART_TEXT_COLOR}
            fontSize={12}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis stroke={CHART_TEXT_COLOR} fontSize={12} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
          <RechartsTooltip content={<ChartTooltipContent />} cursor={{ fill: 'var(--muted)' }} />
          <Bar dataKey="count" fill="var(--chart-2)" radius={[4, 4, 0, 0]} animationDuration={500} />
        </BarChart>
      </ResponsiveContainer>
    </WidgetCard>
  );
}
