'use client';

import dynamic from 'next/dynamic';
import { Clock } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { OrderDetailSheet } from '@/features/dashboard/components/order-detail-sheet';
import { MetricCardsGrid } from '@/features/dashboard/components/metric-cards-grid';
import { QuickActions } from '@/features/dashboard/components/quick-actions';
import { useAuth } from '@/providers/auth-provider';

/**
 * Every chart/heavy widget below is a separate `next/dynamic` chunk
 * (`ssr: false`, since the whole (dashboard) tree is already
 * client-rendered post-auth-gate — see ARCHITECTURE.md §4.2) — this
 * keeps `recharts` and friends out of the initial JS the dashboard
 * route ships, loading each widget's code only once it's actually
 * about to render. The `loading` fallback approximates each widget's
 * real footprint so nothing visibly resizes once its chunk arrives.
 */
const chartSkeleton = <Skeleton className="h-80 w-full rounded-xl" />;

const RevenueTrendChart = dynamic(
  () => import('@/features/dashboard/components/revenue-trend-chart').then((m) => m.RevenueTrendChart),
  { ssr: false, loading: () => chartSkeleton },
);
const OrdersTrendChart = dynamic(
  () => import('@/features/dashboard/components/orders-trend-chart').then((m) => m.OrdersTrendChart),
  { ssr: false, loading: () => chartSkeleton },
);
const RevenueByCanteenChart = dynamic(
  () =>
    import('@/features/dashboard/components/revenue-by-canteen-chart').then(
      (m) => m.RevenueByCanteenChart,
    ),
  { ssr: false, loading: () => chartSkeleton },
);
const OrdersByStatusChart = dynamic(
  () =>
    import('@/features/dashboard/components/orders-by-status-chart').then(
      (m) => m.OrdersByStatusChart,
    ),
  { ssr: false, loading: () => chartSkeleton },
);
const PeakHoursChart = dynamic(
  () => import('@/features/dashboard/components/peak-hours-chart').then((m) => m.PeakHoursChart),
  { ssr: false, loading: () => chartSkeleton },
);
const CategoryRevenueChart = dynamic(
  () =>
    import('@/features/dashboard/components/category-revenue-chart').then(
      (m) => m.CategoryRevenueChart,
    ),
  { ssr: false, loading: () => chartSkeleton },
);
const KitchenStatusWidget = dynamic(
  () =>
    import('@/features/dashboard/components/kitchen-status-widget').then(
      (m) => m.KitchenStatusWidget,
    ),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full rounded-xl" /> },
);
const TopSellingItems = dynamic(
  () => import('@/features/dashboard/components/top-selling-items').then((m) => m.TopSellingItems),
  { ssr: false, loading: () => <Skeleton className="h-80 w-full rounded-xl" /> },
);
const RecentOrdersTable = dynamic(
  () =>
    import('@/features/dashboard/components/recent-orders-table').then((m) => m.RecentOrdersTable),
  { ssr: false, loading: () => <Skeleton className="h-96 w-full rounded-xl" /> },
);
const LiveActivityTimeline = dynamic(
  () =>
    import('@/features/dashboard/components/live-activity-timeline').then(
      (m) => m.LiveActivityTimeline,
    ),
  { ssr: false, loading: () => <Skeleton className="h-96 w-full rounded-xl" /> },
);

function AdminDashboard() {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  return (
    <>
      <MetricCardsGrid />

      <QuickActions />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueTrendChart />
        </div>
        <OrdersByStatusChart />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <OrdersTrendChart />
        <RevenueByCanteenChart />
        <PeakHoursChart />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CategoryRevenueChart />
        <KitchenStatusWidget />
      </div>

      <TopSellingItems />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentOrdersTable onViewOrder={setSelectedOrderId} />
        </div>
        <LiveActivityTimeline />
      </div>

      <OrderDetailSheet orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
    </>
  );
}

function KitchenStaffDashboard() {
  return (
    <EmptyState
      icon={Clock}
      title="Your kitchen queue lands in the next phase"
      description="Dashboard analytics are scoped to admins — as kitchen staff, your home base will be the Kitchen page once it's built."
    />
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back${user ? `, ${user.fullName.split(' ')[0]}` : ''}`}
        description="Here's what's happening across QBite right now."
      />
      {isAdmin ? <AdminDashboard /> : <KitchenStaffDashboard />}
    </div>
  );
}
