import { apiFetchData } from '@/lib/api/client';

export function getUnreadNotificationCount(): Promise<{ count: number }> {
  return apiFetchData<{ count: number }>('/notifications/unread-count');
}
