import { useQuery } from '@tanstack/react-query';
import { getUnreadNotificationCount } from '../api';

/**
 * The backend has no real-time push for this yet (no Socket.IO/FCM
 * layer exists — see ARCHITECTURE.md §4.2's note), so "live" here
 * means "polled," not pushed. 30s is frequent enough to feel current
 * for an ops dashboard without hammering the endpoint.
 */
export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: getUnreadNotificationCount,
    refetchInterval: 30_000,
  });
}
