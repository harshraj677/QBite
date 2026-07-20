'use client';

import { motion } from 'motion/react';
import {
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Clock,
  IndianRupee,
  ShoppingBag,
  Sparkles,
  Store,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useMemo } from 'react';
import { StatCard } from '@/components/shared/stat-card';
import { formatCompactNumber, formatCurrency } from '@/lib/format';
import { useDashboardOverview } from '../hooks/use-dashboard-overview';
import { useOrderAnalytics, useRevenueAnalytics, useUserAnalytics } from '../hooks/use-analytics';
import { computeTrend } from '../utils/compute-trend';

interface MetricDef {
  key: string;
  label: string;
  icon: LucideIcon;
  rawValue?: number;
  format: (v: number) => string;
  tooltip?: string;
  trend?: { value: number; label: string };
}

const WEEK_LABEL = 'vs prior 7 days';

export function MetricCardsGrid() {
  const dashboard = useDashboardOverview();
  // Same `last30days`/`day` request the Revenue Trend chart makes —
  // TanStack Query dedupes this to a single network call by queryKey,
  // so fetching it here too costs nothing extra.
  const revenue = useRevenueAnalytics('last30days', 'day');
  const orders = useOrderAnalytics('last30days');
  const users = useUserAnalytics('last30days');

  const isLoading = dashboard.isPending;

  const revenueTrend = useMemo(() => {
    if (!revenue.data) return null;
    return computeTrend(
      revenue.data.buckets.map((b) => ({ date: b.periodStart, value: b.revenue })),
    );
  }, [revenue.data]);

  const ordersTrend = useMemo(() => {
    if (!orders.data) return null;
    return computeTrend(orders.data.byDay.map((d) => ({ date: d.date, value: d.count })));
  }, [orders.data]);

  const d = dashboard.data;

  const metrics: MetricDef[] = [
    {
      key: 'total-revenue',
      label: 'Total revenue',
      icon: IndianRupee,
      rawValue: d?.revenue.total,
      format: formatCurrency,
      tooltip: 'All-time revenue from paid orders, across every canteen.',
    },
    {
      key: 'today-revenue',
      label: "Today's revenue",
      icon: Sparkles,
      rawValue: d?.revenue.today,
      format: formatCurrency,
      tooltip: 'Revenue from orders paid today. Resets at midnight.',
    },
    {
      key: 'weekly-revenue',
      label: 'Weekly revenue',
      icon: CalendarDays,
      rawValue: d?.revenue.weekly,
      format: formatCurrency,
      trend: revenueTrend !== null ? { value: revenueTrend, label: WEEK_LABEL } : undefined,
      tooltip: 'Last 7 days, inclusive of today.',
    },
    {
      key: 'monthly-revenue',
      label: 'Monthly revenue',
      icon: CalendarRange,
      rawValue: d?.revenue.monthly,
      format: formatCurrency,
      tooltip: 'Month-to-date revenue. Resets on the 1st.',
    },
    {
      key: 'total-orders',
      label: 'Total orders',
      icon: ShoppingBag,
      rawValue: d?.orders.total,
      format: formatCompactNumber,
      trend: ordersTrend !== null ? { value: ordersTrend, label: WEEK_LABEL } : undefined,
      tooltip: 'Every order ever placed, any status.',
    },
    {
      key: 'completed-orders',
      label: 'Completed orders',
      icon: CheckCircle2,
      rawValue: d?.orders.byStatus.completed,
      format: formatCompactNumber,
      tooltip: orders.data
        ? `${orders.data.completionRate}% completion rate over the last 30 days.`
        : 'Orders picked up and closed out.',
    },
    {
      key: 'pending-orders',
      label: 'Pending orders',
      icon: Clock,
      rawValue: d?.orders.byStatus.pending,
      format: formatCompactNumber,
      tooltip: 'Orders waiting for the kitchen to accept them, right now.',
    },
    {
      key: 'active-students',
      label: 'Active students',
      icon: Users,
      rawValue: users.data?.activeUsers,
      format: formatCompactNumber,
      tooltip: users.data
        ? `Placed >=1 order in the last 30 days. ${users.data.newUsers} new signups in the same window.`
        : 'Students who placed at least one order in the last 30 days.',
    },
    {
      key: 'staff',
      label: 'Staff',
      icon: UserCog,
      rawValue: d?.users.totalStaff,
      format: formatCompactNumber,
      tooltip: 'Kitchen staff, admins, and super admins combined.',
    },
    {
      key: 'canteens',
      label: 'Canteens',
      icon: Store,
      rawValue: d?.canteens.total,
      format: formatCompactNumber,
      tooltip: 'Total canteens live on the platform.',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {metrics.map((metric, index) => (
        <motion.div
          key={metric.key}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.04, ease: 'easeOut' }}
        >
          <StatCard
            label={metric.label}
            icon={metric.icon}
            loading={isLoading}
            value={metric.rawValue !== undefined ? metric.format(metric.rawValue) : '—'}
            rawValue={metric.rawValue}
            format={metric.format}
            tooltip={metric.tooltip}
            trend={metric.trend}
          />
        </motion.div>
      ))}
    </div>
  );
}
