import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getNotifications } from '../api';
import type { NotificationsQueryParams } from '../types';

/** Polled, not just fetched-once — a notification feed is a live surface (same reasoning as `useUnreadCount`'s 30s poll), though slower than Kitchen's 10s since this isn't an operational queue. */
export function useNotificationsQuery(params: NotificationsQueryParams) {
  return useQuery({
    queryKey: ['notifications', 'list', params],
    queryFn: () => getNotifications(params),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
