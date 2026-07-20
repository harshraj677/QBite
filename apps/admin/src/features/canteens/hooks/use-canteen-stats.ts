import { useQuery } from '@tanstack/react-query';
import { getOrders } from '@/features/orders/api';
import { useCanteenAnalytics } from '@/features/dashboard/hooks/use-analytics';
import { getActiveMenuItemCount } from '../api';

/**
 * Every number here comes from an endpoint that already existed before
 * this phase — no new analytics logic, per this phase's explicit
 * constraint. "Total Orders" is exact and all-time (`GET /kitchen/orders`'s
 * real pagination `meta.total`, filtered by `canteenId` — the same
 * endpoint the Operations Center already calls). "Revenue" is
 * necessarily range-scoped (`GET /analytics/canteens` has no all-time
 * preset — see ARCHITECTURE.md's note) — the caller is responsible for
 * labeling it with `revenueFilter`, not presenting it as a lifetime
 * total. "Active Menu Items" is exact (`GET /canteens/:id/menu-items`'s
 * real `meta.total` with `isAvailable=true`).
 */
export function useCanteenStats(canteenId: string | null) {
  const ordersQuery = useQuery({
    queryKey: ['canteens', canteenId, 'order-count'],
    queryFn: () => getOrders({ canteenId: canteenId as string, page: 1, limit: 1, sortOrder: 'desc' }),
    enabled: canteenId !== null,
  });

  const revenueFilter = 'last30days' as const;
  const analyticsQuery = useCanteenAnalytics(revenueFilter, 50);

  const menuCountQuery = useQuery({
    queryKey: ['canteens', canteenId, 'active-menu-item-count'],
    queryFn: () => getActiveMenuItemCount(canteenId as string),
    enabled: canteenId !== null,
  });

  const canteenRevenue = analyticsQuery.data?.byCanteen.find((c) => c.canteenId === canteenId);

  return {
    totalOrders: ordersQuery.data?.meta?.total,
    isOrdersPending: ordersQuery.isPending,
    isOrdersError: ordersQuery.isError,
    revenue: canteenRevenue?.revenue ?? 0,
    revenueOrderCount: canteenRevenue?.orderCount ?? 0,
    revenueFilter,
    isRevenuePending: analyticsQuery.isPending,
    isRevenueError: analyticsQuery.isError,
    activeMenuItemCount: menuCountQuery.data,
    isMenuCountPending: menuCountQuery.isPending,
    isMenuCountError: menuCountQuery.isError,
  };
}
