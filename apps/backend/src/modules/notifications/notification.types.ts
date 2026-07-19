import type { Document, Types } from 'mongoose';

/**
 * One entry per order-lifecycle event this phase supports — in-app
 * only (no Firebase push yet, see notifications.service.ts's doc
 * comment). Closed set, same rationale as every other enum in this
 * project (AUDIT_ACTIONS, ORDER_STATUSES, ...): a typo can't silently
 * create an untracked type.
 *
 * `payment_*` entries added for the Payments phase — `notifyOrderEvent`
 * already took a generic `type: NotificationType` (see
 * notifications.service.ts), so extending this enum plus
 * `buildNotificationContent`'s switch was the entire integration;
 * no new method was needed.
 */
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

export interface INotification extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  message: string;
  type: NotificationType;
  orderId?: Types.ObjectId;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicNotificationDto {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  orderId?: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toPublicNotificationDto(notification: INotification): PublicNotificationDto {
  return {
    id: notification._id.toString(),
    userId: notification.userId.toString(),
    title: notification.title,
    message: notification.message,
    type: notification.type,
    orderId: notification.orderId?.toString(),
    isRead: notification.isRead,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
  };
}
