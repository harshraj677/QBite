import { model, Schema } from 'mongoose';

import type { INotification } from './notification.types';
import { NOTIFICATION_TYPES } from './notification.types';

/** See docs/DATABASE_DESIGN.md §2.19 for field-by-field rationale. */
const notificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

// A user's own notification feed, most recent first — GET /notifications.
notificationSchema.index({ userId: 1, createdAt: -1 });
// The unread-count badge and "unread only" filtering — GET /notifications/unread-count.
notificationSchema.index({ userId: 1, isRead: 1 });

export const NotificationModel = model<INotification>('Notification', notificationSchema);
