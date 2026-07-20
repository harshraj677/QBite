'use client';

import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';
import { WidgetCard } from '@/components/shared/widget-card';
import { useOrderAnalytics } from '../hooks/use-analytics';
import { ORDER_STATUS_CHART_COLOR, ORDER_STATUS_LABELS, ORDER_STATUS_ORDER } from '@/lib/order-status';

function ChartTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { status: string; label: string; count: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-popover-foreground">{point.label}</p>
      <p className="mt-1 text-muted-foreground">
        <span className="font-semibold text-foreground">{point.count}</span> orders
      </p>
    </div>
  );
}

/** Same `last30days` order-status breakdown the metric cards' completion rate is computed from — a donut plus a compact legend, deliberately not duplicating the badge-row summary the Kitchen Status widget below already gives a fuller (progress-bar) treatment to. */
export function OrdersByStatusChart() {
  const { data, isPending, isError, refetch } = useOrderAnalytics('last30days');

  const chartData = useMemo(() => {
    if (!data) return [];
    return ORDER_STATUS_ORDER.map((status) => ({
      status,
      label: ORDER_STATUS_LABELS[status],
      count: data.byStatus[status] ?? 0,
    })).filter((entry) => entry.count > 0);
  }, [data]);

  const total = chartData.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <WidgetCard
      title="Orders by status"
      description="Last 30 days"
      isLoading={isPending}
      isError={isError}
      onRetry={refetch}
      isEmpty={!isPending && chartData.length === 0}
      emptyIcon={PieChartIcon}
      emptyTitle="No orders in this window"
      contentHeight="h-72"
    >
      <div className="flex h-72 items-center gap-6">
        <ResponsiveContainer width="60%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="label"
              innerRadius="62%"
              outerRadius="90%"
              paddingAngle={2}
              animationDuration={500}
            >
              {chartData.map((entry) => (
                <Cell key={entry.status} fill={ORDER_STATUS_CHART_COLOR[entry.status]} stroke="none" />
              ))}
            </Pie>
            <RechartsTooltip content={<ChartTooltipContent />} />
          </PieChart>
        </ResponsiveContainer>
        <ul className="flex-1 space-y-2.5 text-sm">
          {chartData.map((entry) => (
            <li key={entry.status} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: ORDER_STATUS_CHART_COLOR[entry.status] }}
                  aria-hidden
                />
                {entry.label}
              </span>
              <span className="font-medium tabular-nums text-foreground">
                {total > 0 ? Math.round((entry.count / total) * 100) : 0}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </WidgetCard>
  );
}
