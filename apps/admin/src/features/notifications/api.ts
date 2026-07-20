import { apiFetch, apiFetchData, type ApiResult, type QueryValue } from '@/lib/api/client';
import type { NotificationDto, NotificationsQueryParams } from './types';

export function getUnreadNotificationCount(): Promise<{ count: number }> {
  return apiFetchData<{ count: number }>('/notifications/unread-count');
}

/** `GET /notifications` — self-scoped to the caller; there is no admin-any-user endpoint (see notifications.routes.ts's doc comment — real, existing, deliberate design, not a gap). Bare array + real pagination meta, same envelope shape as every other list endpoint. */
export function getNotifications(params: NotificationsQueryParams): Promise<ApiResult<NotificationDto[]>> {
  return apiFetch<NotificationDto[]>('/notifications', {
    query: params as unknown as Record<string, QueryValue>,
  });
}

/** `PATCH /notifications/:id/read` — unwraps the `{ notification }` response envelope. */
export async function markNotificationAsRead(id: string): Promise<NotificationDto> {
  const { notification } = await apiFetchData<{ notification: NotificationDto }>(
    `/notifications/${id}/read`,
    { method: 'PATCH' },
  );
  return notification;
}

/** `PATCH /notifications/read-all` — the one real bulk-shaped action this backend supports: every unread notification for the caller, not a selected subset (see notifications.routes.ts — there is no bulk-by-id-list endpoint). Response is `{ updatedCount }` directly, not wrapped in a further named key. */
export function markAllNotificationsAsRead(): Promise<{ updatedCount: number }> {
  return apiFetchData<{ updatedCount: number }>('/notifications/read-all', { method: 'PATCH' });
}

/** `DELETE /notifications/:id` — single-item only; no bulk delete exists. */
export function deleteNotification(id: string): Promise<null> {
  return apiFetchData<null>(`/notifications/${id}`, { method: 'DELETE' });
}
