import { useQuery } from '@tanstack/react-query';
import { getOrderDetail, getRecentOrders } from '../api';

/** Short stale time — unlike the historical analytics aggregates, this is meant to feel "live" (it backs both the Recent Orders table and the derived Live Activity timeline), so it refetches on an interval rather than sitting stale for minutes. */
export function useRecentOrders(limit = 20) {
  return useQuery({
    queryKey: ['orders', 'recent', limit],
    queryFn: () => getRecentOrders({ limit }),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useOrderDetail(id: string | null) {
  return useQuery({
    queryKey: ['orders', 'detail', id],
    queryFn: () => getOrderDetail(id as string),
    enabled: id !== null,
  });
}
