import type { NotificationType } from '@/features/notifications/types';

/** Single source of truth for how a notification type renders anywhere in the app — same "one map, imported everywhere" convention as `order-status.ts`/`user-role.ts`. */
export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  order_placed: 'Order placed',
  order_accepted: 'Order accepted',
  order_preparing: 'Order preparing',
  order_ready: 'Order ready',
  order_completed: 'Order completed',
  order_cancelled: 'Order cancelled',
  payment_success: 'Payment success',
  payment_failed: 'Payment failed',
  payment_refunded: 'Payment refunded',
};

export const NOTIFICATION_TYPE_BADGE_VARIANT: Record<
  NotificationType,
  'secondary' | 'warning' | 'success' | 'destructive'
> = {
  order_placed: 'secondary',
  order_accepted: 'warning',
  order_preparing: 'warning',
  order_ready: 'warning',
  order_completed: 'success',
  order_cancelled: 'destructive',
  payment_success: 'success',
  payment_failed: 'destructive',
  payment_refunded: 'warning',
};
