import type { Types } from 'mongoose';

import { logger } from '@logging/logger';
import { NotFoundError } from '@errors/http-errors';
import { NotificationsRepository } from './notifications.repository';
import type { NotificationType, PublicNotificationDto } from './notification.types';
import { toPublicNotificationDto } from './notification.types';
import type { ListNotificationsQuery } from './notifications.validation';

export interface PublicNotificationListResult {
  notifications: PublicNotificationDto[];
  total: number;
}

export interface NotifyOrderEventInput {
  userId: string | Types.ObjectId;
  type: NotificationType;
  orderId: string | Types.ObjectId;
  orderNumber: string;
  /** Only meaningful for `order_ready` — shown in the notification so the student doesn't have to reopen the order. */
  pickupToken?: string;
  /** Only meaningful for `order_cancelled`. */
  cancellationReason?: string;
}

/** One line per NotificationType — kept as a plain lookup, not a switch, since every branch has the identical (title, message) shape and no branch needs special control flow. */
function buildNotificationContent(input: NotifyOrderEventInput): {
  title: string;
  message: string;
} {
  switch (input.type) {
    case 'order_placed':
      return {
        title: 'Order Placed',
        message: `Your order ${input.orderNumber} has been placed successfully.`,
      };
    case 'order_accepted':
      return {
        title: 'Order Accepted',
        message: `Your order ${input.orderNumber} has been accepted by the kitchen.`,
      };
    case 'order_preparing':
      return {
        title: 'Order Preparing',
        message: `Your order ${input.orderNumber} is now being prepared.`,
      };
    case 'order_ready':
      return {
        title: 'Order Ready for Pickup',
        message: input.pickupToken
          ? `Your order ${input.orderNumber} is ready for pickup! Show code ${input.pickupToken} at the counter.`
          : `Your order ${input.orderNumber} is ready for pickup!`,
      };
    case 'order_completed':
      return {
        title: 'Order Completed',
        message: `Your order ${input.orderNumber} has been completed. Enjoy your meal!`,
      };
    case 'order_cancelled':
      return {
        title: 'Order Cancelled',
        message: input.cancellationReason
          ? `Your order ${input.orderNumber} has been cancelled. Reason: ${input.cancellationReason}`
          : `Your order ${input.orderNumber} has been cancelled.`,
      };
  }
}

/**
 * In-app notifications only for this phase — no Firebase push
 * delivery yet (FCM_* env vars exist as unused placeholders, same
 * status as Razorpay's — see .env.example). `notifyOrderEvent` is
 * this module's *public integration surface* for other modules (today,
 * only `orders/`) — everything else here is this module's own CRUD,
 * scoped to the authenticated caller.
 */
export class NotificationsService {
  constructor(
    private readonly notificationsRepository: NotificationsRepository = new NotificationsRepository(),
  ) {}

  async listMyNotifications(
    userId: string,
    query: ListNotificationsQuery,
  ): Promise<PublicNotificationListResult> {
    const result = await this.notificationsRepository.findByUser({
      userId,
      page: query.page,
      limit: query.limit,
      isRead: query.isRead,
      sortOrder: query.sortOrder,
    });
    return {
      notifications: result.notifications.map(toPublicNotificationDto),
      total: result.total,
    };
  }

  getUnreadCount(userId: string): Promise<number> {
    return this.notificationsRepository.countUnread(userId);
  }

  /**
   * 404 for "not found" AND "belongs to someone else" — never 403.
   * Unlike Orders (where a student legitimately might want to know
   * "this order isn't mine" vs "doesn't exist"), nobody has a
   * legitimate reason to learn whether a given notification id exists
   * for another user, so both cases collapse into the same response.
   * The repository's own filter (userId baked into the query) is what
   * actually enforces this, not this check — this is just where the
   * null gets turned into the right HTTP error.
   */
  async markAsRead(id: string, userId: string): Promise<PublicNotificationDto> {
    const updated = await this.notificationsRepository.markAsRead(id, userId);
    if (!updated) {
      throw new NotFoundError('NOTIFICATION_NOT_FOUND', 'Notification not found.');
    }
    return toPublicNotificationDto(updated);
  }

  async markAllAsRead(userId: string): Promise<{ updatedCount: number }> {
    const updatedCount = await this.notificationsRepository.markAllAsRead(userId);
    return { updatedCount };
  }

  async deleteNotification(id: string, userId: string): Promise<void> {
    const deleted = await this.notificationsRepository.deleteById(id, userId);
    if (!deleted) {
      throw new NotFoundError('NOTIFICATION_NOT_FOUND', 'Notification not found.');
    }
  }

  /**
   * Never throws — a failure to write a notification must not break
   * the order lifecycle event that triggered it. Same pattern as
   * `AuditLogService.record()`. This is the method `orders/` calls
   * (see ARCHITECTURE.md §3.1's `modules/notifications` note) — it
   * takes plain primitives (userId, orderId, orderNumber, ...), never
   * an Order document or DTO, so this module has no dependency on
   * `orders/` in either direction.
   */
  async notifyOrderEvent(input: NotifyOrderEventInput): Promise<void> {
    try {
      const { title, message } = buildNotificationContent(input);
      await this.notificationsRepository.create({
        userId: input.userId,
        title,
        message,
        type: input.type,
        orderId: input.orderId,
      });
    } catch (error) {
      logger.error({ err: error }, 'Failed to write order notification');
    }
  }
}
