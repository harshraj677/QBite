/** Mirrors apps/backend/src/modules/notifications/notification.types.ts's NOTIFICATION_TYPES/PublicNotificationDto exactly. */
export const NOTIFICATION_TYPES = [
  'order_placed',
  'order_accepted',
  'order_preparing',
  'order_ready',
  'order_completed',
  'order_cancelled',
  'payment_success',
  'payment_failed',
  'payment_refunded',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotificationDto {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  orderId?: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationsQueryParams {
  page: number;
  limit: number;
  isRead?: boolean;
  sortOrder: 'asc' | 'desc';
}
