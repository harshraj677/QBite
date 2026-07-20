'use client';

import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { LineChart } from 'lucide-react';
import { WidgetCard } from '@/components/shared/widget-card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CHART_GRID_COLOR, CHART_TEXT_COLOR } from '@/lib/chart-colors';
import { formatChartDate, formatCurrency } from '@/lib/format';
import { useRevenueAnalytics } from '../hooks/use-analytics';
import type { DateRangeFilterName, RevenueGranularityName } from '../types';

const RANGE_OPTIONS: Array<{ value: DateRangeFilterName; label: string; granularity: RevenueGranularityName }> = [
  { value: 'last7days', label: '7D', granularity: 'day' },
  { value: 'last30days', label: '30D', granularity: 'day' },
  { value: 'currentMonth', label: 'MTD', granularity: 'day' },
  { value: 'currentYear', label: '1Y', granularity: 'month' },
];

function ChartTooltipContent({
  active,
  payload,
  granularity,
}: {
  active?: boolean;
  payload?: Array<{ payload: { periodStart: string; revenue: number; orderCount: number } }>;
  granularity: RevenueGranularityName;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-popover-foreground">
        {formatChartDate(point.periodStart, granularity)}
      </p>
      <p className="mt-1 text-muted-foreground">
        Revenue <span className="font-semibold text-foreground">{formatCurrency(point.revenue)}</span>
      </p>
      <p className="text-muted-foreground">
        Orders <span className="font-semibold text-foreground">{point.orderCount}</span>
      </p>
    </div>
  );
}

/**
 * The dashboard's "hero" chart — Stripe/Vercel-style gradient area
 * chart. The range switcher is real and interactive: each tab is a
 * genuinely different `GET /analytics/revenue` request (filter +
 * matching granularity), not a client-side slice of one fixed
 * payload.
 */
export function RevenueTrendChart() {
  const [range, setRange] = useState<(typeof RANGE_OPTIONS)[number]>(RANGE_OPTIONS[1]);
  const { data, isPending, isError, refetch } = useRevenueAnalytics(range.value, range.granularity);

  const chartData = useMemo(() => data?.buckets ?? [], [data]);

  return (
    <WidgetCard
      title="Revenue trend"
      description={data ? `${formatCurrency(data.totalRevenue)} total in this window` : undefined}
      isLoading={isPending}
      isError={isError}
      onRetry={refetch}
      isEmpty={!isPending && chartData.length === 0}
      emptyIcon={LineChart}
      emptyTitle="No revenue in this window"
      emptyDescription="Try a wider date range."
      contentHeight="h-72"
      actions={
        <Tabs value={range.value} onValueChange={(v) => {
          const next = RANGE_OPTIONS.find((o) => o.value === v);
          if (next) setRange(next);
        }}>
          <TabsList>
            {RANGE_OPTIONS.map((option) => (
              <TabsTrigger key={option.value} value={option.value}>
                {option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      }
    >
      <ResponsiveContainer width="100%" height={288}>
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} vertical={false} />
          <XAxis
            dataKey="periodStart"
            tickFormatter={(value: string) => formatChartDate(value, range.granularity)}
            stroke={CHART_TEXT_COLOR}
            fontSize={12}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            stroke={CHART_TEXT_COLOR}
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => formatCurrency(value).replace('.00', '')}
            width={64}
          />
          <RechartsTooltip content={<ChartTooltipContent granularity={range.granularity} />} />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#revenue-fill)"
            animationDuration={500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </WidgetCard>
  );
}
