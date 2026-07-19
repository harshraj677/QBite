import type { Types } from 'mongoose';

import { NotificationModel } from './notification.model';
import type { INotification, NotificationType } from './notification.types';

export interface CreateNotificationInput {
  userId: string | Types.ObjectId;
  title: string;
  message: string;
  type: NotificationType;
  orderId?: string | Types.ObjectId;
}

export interface ListNotificationsOptions {
  userId: string | Types.ObjectId;
  page: number;
  limit: number;
  isRead?: boolean;
  sortOrder: 'asc' | 'desc';
}

export interface ListNotificationsResult {
  notifications: INotification[];
  total: number;
}

/**
 * All Mongoose queries for the `notifications` collection live here —
 * per ARCHITECTURE.md §3.1's layering rule, nothing outside this file
 * touches `NotificationModel` directly.
 *
 * Every method that reads/mutates a specific notification bakes
 * `userId` into the query filter itself, not just a service-level
 * check — same "invariant belongs in the query, not just the caller"
 * convention as every other module (e.g. OrdersRepository.updateStatus's
 * `fromStatus` guard). A notification that exists but belongs to a
 * different user is indistinguishable from one that doesn't exist at
 * all — nobody has a legitimate reason to learn otherwise. See
 * notifications.service.ts for why that's always surfaced as a 404,
 * never a 403.
 */
export class NotificationsRepository {
  create(input: CreateNotificationInput): Promise<INotification> {
    return NotificationModel.create(input);
  }

  async findByUser(options: ListNotificationsOptions): Promise<ListNotificationsResult> {
    const filter: Record<string, unknown> = { userId: options.userId };
    if (options.isRead !== undefined) filter.isRead = options.isRead;

    const sort: Record<string, 1 | -1> = { createdAt: options.sortOrder === 'asc' ? 1 : -1 };
    const skip = (options.page - 1) * options.limit;

    const [notifications, total] = await Promise.all([
      NotificationModel.find(filter).sort(sort).skip(skip).limit(options.limit).exec(),
      NotificationModel.countDocuments(filter).exec(),
    ]);

    return { notifications, total };
  }

  countUnread(userId: string | Types.ObjectId): Promise<number> {
    return NotificationModel.countDocuments({ userId, isRead: false }).exec();
  }

  /** Idempotent — no state-machine guard needed (unlike Order status transitions), marking an already-read notification read again is a harmless no-op. */
  markAsRead(
    id: string | Types.ObjectId,
    userId: string | Types.ObjectId,
  ): Promise<INotification | null> {
    return NotificationModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: { isRead: true } },
      { returnDocument: 'after' },
    ).exec();
  }

  async markAllAsRead(userId: string | Types.ObjectId): Promise<number> {
    const result = await NotificationModel.updateMany(
      { userId, isRead: false },
      { $set: { isRead: true } },
    ).exec();
    return result.modifiedCount;
  }

  /** Hard delete — unlike Orders/menu/canteens, notifications are ephemeral, user-manageable items with no "immutable history" requirement, so a real DELETE is the correct semantic here. */
  async deleteById(id: string | Types.ObjectId, userId: string | Types.ObjectId): Promise<boolean> {
    const result = await NotificationModel.deleteOne({ _id: id, userId }).exec();
    return result.deletedCount > 0;
  }
}
