import { useQuery } from '@tanstack/react-query';
import { getMenuAnalytics } from '../api';
import type { MenuItemSalesDto } from '../types';

export interface TopSellingItemWithGrowth extends MenuItemSalesDto {
  /** Signed percentage vs. the prior 30-day window, matched by `itemId`. `null` when the item sold nothing in the prior window — a percentage would be undefined (division by zero), not "very high growth," so it's surfaced as "New" in the UI rather than an invented number. */
  growthPercent: number | null;
}

function previousThirtyDayWindow(): { startDate: string; endDate: string } {
  const now = new Date();
  const currentWindowStart = new Date(now);
  currentWindowStart.setDate(currentWindowStart.getDate() - 29);
  const previousEnd = new Date(currentWindowStart);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - 29);
  return { startDate: previousStart.toISOString(), endDate: previousEnd.toISOString() };
}

/**
 * Real growth, not a fabricated number: fetches the current `last30days`
 * top-selling items, then a second `custom` request for the 30 days
 * immediately before that, and computes `growthPercent` per item by
 * matching `itemId` across both. Two real requests, genuinely
 * comparable equal-length windows — no invented baseline.
 */
export function useTopSellingItemsWithGrowth(limit = 8) {
  const current = useQuery({
    queryKey: ['analytics', 'menu', 'last30days', limit],
    queryFn: () => getMenuAnalytics({ filter: 'last30days', limit }),
    staleTime: 5 * 60_000,
  });

  const { startDate, endDate } = previousThirtyDayWindow();
  const previous = useQuery({
    queryKey: ['analytics', 'menu', 'custom', startDate, endDate, limit],
    queryFn: () => getMenuAnalytics({ filter: 'custom', startDate, endDate, limit: 50 }),
    staleTime: 5 * 60_000,
    enabled: current.isSuccess,
  });

  const items: TopSellingItemWithGrowth[] | undefined = current.data?.topSellingItems.map(
    (item) => {
      const previousItem = previous.data?.revenuePerItem.find((p) => p.itemId === item.itemId);
      if (!previous.isSuccess) return { ...item, growthPercent: null };
      if (!previousItem || previousItem.quantitySold === 0) return { ...item, growthPercent: null };
      const growth =
        ((item.quantitySold - previousItem.quantitySold) / previousItem.quantitySold) * 100;
      return { ...item, growthPercent: Math.round(growth * 10) / 10 };
    },
  );

  return {
    items,
    isPending: current.isPending,
    isError: current.isError,
    refetch: current.refetch,
  };
}
