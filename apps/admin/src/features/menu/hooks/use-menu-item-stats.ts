import { useMenuAnalytics } from '@/features/dashboard/hooks/use-analytics';

const STATS_FILTER = 'last30days' as const;
const STATS_LIMIT = 50; // MAX_TOP_N — generous enough to cover a campus canteen's full catalog in practice

/**
 * Reuses the existing `GET /analytics/menu` endpoint (`useMenuAnalytics`,
 * already built for the Dashboard) — no new aggregation, per this
 * phase's explicit constraint. `revenuePerItem` is a top-N list, not a
 * per-item lookup, so a real item simply absent from it (no sales in
 * the resolved window) is presented as an honest zero, not "not
 * available" — that's the far more likely explanation than "outside
 * the top 50" for a realistic campus-canteen catalog. The backend has
 * no per-item *order count* field (only `quantitySold`, a materially
 * different number when an order contains >1 of the same item) — this
 * is surfaced as "Units sold," not mislabeled as "Order Count."
 */
export function useMenuItemStats(itemId: string | null) {
  const query = useMenuAnalytics(STATS_FILTER, STATS_LIMIT);
  const entry = query.data?.revenuePerItem.find((row) => row.itemId === itemId);

  return {
    isPending: query.isPending,
    isError: query.isError,
    filter: STATS_FILTER,
    quantitySold: entry?.quantitySold ?? 0,
    revenue: entry?.revenue ?? 0,
  };
}
