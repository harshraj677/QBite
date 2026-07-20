import { useQuery } from '@tanstack/react-query';
import {
  getCanteenAnalytics,
  getMenuAnalytics,
  getOrderAnalytics,
  getRevenueAnalytics,
  getUserAnalytics,
} from '../api';
import type { DateRangeFilterName, RevenueGranularityName } from '../types';

/** 5 minutes — analytics aggregates over a fixed historical window don't change second-to-second; refetching on every focus/mount would just hammer MongoDB for identical numbers. */
const ANALYTICS_STALE_TIME = 5 * 60_000;

export function useRevenueAnalytics(
  filter: DateRangeFilterName = 'last30days',
  granularity: RevenueGranularityName = 'day',
) {
  return useQuery({
    queryKey: ['analytics', 'revenue', filter, granularity],
    queryFn: () => getRevenueAnalytics({ filter, granularity }),
    staleTime: ANALYTICS_STALE_TIME,
  });
}

export function useOrderAnalytics(filter: DateRangeFilterName = 'last30days') {
  return useQuery({
    queryKey: ['analytics', 'orders', filter],
    queryFn: () => getOrderAnalytics({ filter }),
    staleTime: ANALYTICS_STALE_TIME,
  });
}

export function useMenuAnalytics(filter: DateRangeFilterName = 'last30days', limit = 10) {
  return useQuery({
    queryKey: ['analytics', 'menu', filter, limit],
    queryFn: () => getMenuAnalytics({ filter, limit }),
    staleTime: ANALYTICS_STALE_TIME,
  });
}

export function useCanteenAnalytics(filter: DateRangeFilterName = 'last30days', limit = 10) {
  return useQuery({
    queryKey: ['analytics', 'canteens', filter, limit],
    queryFn: () => getCanteenAnalytics({ filter, limit }),
    staleTime: ANALYTICS_STALE_TIME,
  });
}

export function useUserAnalytics(filter: DateRangeFilterName = 'last30days', limit = 10) {
  return useQuery({
    queryKey: ['analytics', 'users', filter, limit],
    queryFn: () => getUserAnalytics({ filter, limit }),
    staleTime: ANALYTICS_STALE_TIME,
  });
}
