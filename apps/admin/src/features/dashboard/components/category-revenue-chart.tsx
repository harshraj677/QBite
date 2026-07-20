'use client';

import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Tags } from 'lucide-react';
import { WidgetCard } from '@/components/shared/widget-card';
import { CHART_COLORS } from '@/lib/chart-colors';
import { formatCurrency } from '@/lib/format';
import { useMenuAnalytics } from '../hooks/use-analytics';

function ChartTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { categoryName: string; revenue: number; quantitySold: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-popover-foreground">{point.categoryName}</p>
      <p className="mt-1 text-muted-foreground">
        Revenue <span className="font-semibold text-foreground">{formatCurrency(point.revenue)}</span>
      </p>
      <p className="text-muted-foreground">
        Sold <span className="font-semibold text-foreground">{point.quantitySold}</span>
      </p>
    </div>
  );
}

export function CategoryRevenueChart() {
  const { data, isPending, isError, refetch } = useMenuAnalytics('last30days', 8);
  const chartData = useMemo(() => data?.revenuePerCategory ?? [], [data]);

  return (
    <WidgetCard
      title="Category revenue"
      description="Last 30 days"
      isLoading={isPending}
      isError={isError}
      onRetry={refetch}
      isEmpty={!isPending && chartData.length === 0}
      emptyIcon={Tags}
      emptyTitle="No category sales yet"
      contentHeight="h-72"
    >
      <div className="flex h-72 items-center gap-6">
        <ResponsiveContainer width="60%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="revenue"
              nameKey="categoryName"
              innerRadius="62%"
              outerRadius="90%"
              paddingAngle={2}
              animationDuration={500}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={entry.categoryName}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                  stroke="none"
                />
              ))}
            </Pie>
            <RechartsTooltip content={<ChartTooltipContent />} />
          </PieChart>
        </ResponsiveContainer>
        <ul className="flex-1 space-y-2.5 overflow-hidden text-sm">
          {chartData.slice(0, 6).map((entry, index) => (
            <li key={entry.categoryName} className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 truncate text-muted-foreground">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                  aria-hidden
                />
                <span className="truncate">{entry.categoryName}</span>
              </span>
              <span className="shrink-0 font-medium tabular-nums text-foreground">
                {formatCurrency(entry.revenue)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </WidgetCard>
  );
}
