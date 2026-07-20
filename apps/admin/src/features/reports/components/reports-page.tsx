'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const chartSkeleton = <Skeleton className="h-80 w-full rounded-xl" />;

/**
 * Every widget below is its own `next/dynamic` chunk, same convention
 * as `app/(dashboard)/dashboard/page.tsx` — kept out of the initial JS
 * for this route, loaded once its tab is actually opened. Combined
 * with `TabsContent` unmounting inactive panels, a tab's chart code
 * doesn't even fetch until that tab is selected, not just at mount —
 * a stronger form of "lazy-load charts" than the (all-visible,
 * un-tabbed) Dashboard achieves, since there every widget loads on
 * page mount regardless of scroll position.
 */
const RevenueTrendChart = dynamic(
  () => import('@/features/dashboard/components/revenue-trend-chart').then((m) => m.RevenueTrendChart),
  { ssr: false, loading: () => chartSkeleton },
);
const OrdersByStatusChart = dynamic(
  () =>
    import('@/features/dashboard/components/orders-by-status-chart').then(
      (m) => m.OrdersByStatusChart,
    ),
  { ssr: false, loading: () => chartSkeleton },
);
const OrdersTrendChart = dynamic(
  () => import('@/features/dashboard/components/orders-trend-chart').then((m) => m.OrdersTrendChart),
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
const TopSellingItems = dynamic(
  () => import('@/features/dashboard/components/top-selling-items').then((m) => m.TopSellingItems),
  { ssr: false, loading: () => chartSkeleton },
);
const RevenueByCanteenChart = dynamic(
  () =>
    import('@/features/dashboard/components/revenue-by-canteen-chart').then(
      (m) => m.RevenueByCanteenChart,
    ),
  { ssr: false, loading: () => chartSkeleton },
);

const OrdersOverviewCards = dynamic(
  () => import('./orders-overview-cards').then((m) => m.OrdersOverviewCards),
  { ssr: false, loading: () => <Skeleton className="h-24 w-full rounded-xl" /> },
);
const LowestSellingItems = dynamic(
  () => import('./lowest-selling-items').then((m) => m.LowestSellingItems),
  { ssr: false, loading: () => chartSkeleton },
);
const CanteenPerformanceTable = dynamic(
  () => import('./canteen-performance-table').then((m) => m.CanteenPerformanceTable),
  { ssr: false, loading: () => chartSkeleton },
);
const UserAnalyticsSection = dynamic(
  () => import('./user-analytics-section').then((m) => m.UserAnalyticsSection),
  { ssr: false, loading: () => <Skeleton className="h-96 w-full rounded-xl" /> },
);
const ExportPanel = dynamic(() => import('./export-panel').then((m) => m.ExportPanel), {
  ssr: false,
  loading: () => chartSkeleton,
});

const TABS = [
  { value: 'revenue', label: 'Revenue' },
  { value: 'orders', label: 'Orders' },
  { value: 'menu', label: 'Menu' },
  { value: 'canteens', label: 'Canteens' },
  { value: 'users', label: 'Users' },
  { value: 'export', label: 'Export' },
] as const;

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['value']>('revenue');

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reports & Analytics"
        description="Business insights, trends, and operational reporting — every number sourced live from the Analytics API."
      />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="revenue" className="space-y-4 pt-4">
          <RevenueTrendChart />
        </TabsContent>

        <TabsContent value="orders" className="space-y-4 pt-4">
          <OrdersOverviewCards />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <OrdersByStatusChart />
            <PeakHoursChart />
          </div>
          <OrdersTrendChart />
        </TabsContent>

        <TabsContent value="menu" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TopSellingItems />
            <LowestSellingItems />
          </div>
          <CategoryRevenueChart />
        </TabsContent>

        <TabsContent value="canteens" className="space-y-4 pt-4">
          <RevenueByCanteenChart />
          <CanteenPerformanceTable />
        </TabsContent>

        <TabsContent value="users" className="pt-4">
          <UserAnalyticsSection />
        </TabsContent>

        <TabsContent value="export" className="pt-4">
          <ExportPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
