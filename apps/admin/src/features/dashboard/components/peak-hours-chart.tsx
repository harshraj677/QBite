'use client';

import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { Clock } from 'lucide-react';
import { WidgetCard } from '@/components/shared/widget-card';
import { CHART_GRID_COLOR, CHART_TEXT_COLOR } from '@/lib/chart-colors';
import { formatHourLabel } from '@/lib/format';
import { useOrderAnalytics } from '../hooks/use-analytics';

function ChartTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { hour: number; count: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-popover-foreground">{formatHourLabel(point.hour)}</p>
      <p className="mt-1 text-muted-foreground">
        <span className="font-semibold text-foreground">{point.count}</span> orders placed
      </p>
    </div>
  );
}

/** All 24 hours always render (zero-filled), so the bar chart's x-axis is a stable, complete clock face rather than only showing hours that happened to have an order — the busiest bar is highlighted at full opacity, the rest dimmed, a cheap way to draw the eye to peak hours without a second color. */
export function PeakHoursChart() {
  const { data, isPending, isError, refetch } = useOrderAnalytics('last30days');

  const chartData = useMemo(() => {
    const byHour = new Map(data?.peakOrderingHours.map((h) => [h.hour, h.count]) ?? []);
    return Array.from({ length: 24 }, (_, hour) => ({ hour, count: byHour.get(hour) ?? 0 }));
  }, [data]);

  const maxCount = Math.max(...chartData.map((d) => d.count), 0);

  return (
    <WidgetCard
      title="Peak ordering hours"
      description="Last 30 days, by hour of day"
      isLoading={isPending}
      isError={isError}
      onRetry={refetch}
      isEmpty={!isPending && maxCount === 0}
      emptyIcon={Clock}
      emptyTitle="No orders in this window"
      contentHeight="h-72"
    >
      <ResponsiveContainer width="100%" height={288}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} vertical={false} />
          <XAxis
            dataKey="hour"
            tickFormatter={(value: number) => (value % 3 === 0 ? formatHourLabel(value) : '')}
            stroke={CHART_TEXT_COLOR}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <YAxis stroke={CHART_TEXT_COLOR} fontSize={12} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
          <RechartsTooltip content={<ChartTooltipContent />} cursor={{ fill: 'var(--muted)' }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} animationDuration={500}>
            {chartData.map((entry) => (
              <Cell
                key={entry.hour}
                fill="var(--chart-1)"
                fillOpacity={maxCount > 0 && entry.count === maxCount ? 1 : 0.35}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </WidgetCard>
  );
}
