'use client';

import { CheckCircle2, Clock, IndianRupee, Percent, XCircle } from 'lucide-react';
import { StatCard } from '@/components/shared/stat-card';
import { formatCurrency } from '@/lib/format';
import { useRevenueAnalytics } from '@/features/dashboard/hooks/use-analytics';
import { usePaymentStatusCounts } from '../hooks/use-payment-status-counts';

/**
 * "Reuse existing Analytics and Payment APIs... do not create new
 * aggregation endpoints" — Total Revenue reuses the existing
 * `GET /analytics/revenue` (`useRevenueAnalytics`, already built for
 * the Dashboard), range-scoped like every other reuse of it this
 * session (no all-time preset exists there). The other four numbers
 * come from `usePaymentStatusCounts` — four real, exact
 * `GET /kitchen/orders?paymentStatus=X` counts, not a new aggregate.
 */
export function PaymentsAnalyticsStrip() {
  const revenue = useRevenueAnalytics('last30days', 'day');
  const { counts, successRate, isPending } = usePaymentStatusCounts();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <StatCard
        label="Total revenue"
        icon={IndianRupee}
        loading={revenue.isPending}
        value={revenue.data ? formatCurrency(revenue.data.totalRevenue) : '—'}
        tooltip="Last 30 days, paid orders only."
      />
      <StatCard
        label="Successful payments"
        icon={CheckCircle2}
        loading={isPending}
        value={counts.paid}
        tooltip="All-time, exact count."
      />
      <StatCard
        label="Failed payments"
        icon={XCircle}
        loading={isPending}
        value={counts.failed}
        tooltip="All-time, exact count."
      />
      <StatCard
        label="Pending payments"
        icon={Clock}
        loading={isPending}
        value={counts.pending}
        tooltip="All-time, exact count."
      />
      <StatCard
        label="Success rate"
        icon={Percent}
        loading={isPending}
        value={`${successRate}%`}
        tooltip="Successful ÷ (successful + failed + pending + refunded), all-time."
      />
    </div>
  );
}
