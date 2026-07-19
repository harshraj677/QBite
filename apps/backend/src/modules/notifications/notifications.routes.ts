import { Router } from 'express';

import { authenticate } from '@modules/auth/auth.middleware';
import { validateRequest } from '@validation/validate-request.middleware';
import { NotificationsController } from './notifications.controller';
import {
  listNotificationsQuerySchema,
  notificationIdParamSchema,
} from './notifications.validation';

export const notificationsRouter = Router();
const controller = new NotificationsController();

/**
 * No `requireRole()` on any route here — every authenticated role may
 * have notifications (today, only students do, since every
 * OrdersService.notifyOrderEvent call targets `order.studentId`, but
 * nothing in this module assumes that). Authorization is purely
 * ownership-based: every query is scoped to `req.user.id`, enforced
 * in the repository's own filter (see notifications.repository.ts).
 * There is no admin-any-user path — "Admins cannot read student
 * notifications unless such functionality already exists," and it
 * doesn't.
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         userId: { type: string }
 *         title: { type: string }
 *         message: { type: string }
 *         type: { type: string, enum: [order_placed, order_accepted, order_preparing, order_ready, order_completed, order_cancelled] }
 *         orderId: { type: string }
 *         isRead: { type: boolean }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 */

/**
 * @openapi
 * /api/v1/notifications:
 *   get:
 *     summary: List the authenticated user's own notifications
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 50 }
 *       - in: query
 *         name: isRead
 *         schema: { type: boolean }
 *       - in: query
 *         name: sortOrder
 *         description: "asc = oldest first, desc = newest first"
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *     responses:
 *       200:
 *         description: Paginated notification list.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: array, items: { $ref: '#/components/schemas/Notification' } }
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     hasMore: { type: boolean }
 *       401:
 *         description: Missing/invalid access token.
 */
notificationsRouter.get(
  '/',
  authenticate(),
  validateRequest({ query: listNotificationsQuerySchema }),
  controller.list,
);

/**
 * @openapi
 * /api/v1/notifications/unread-count:
 *   get:
 *     summary: Get the authenticated user's unread notification count
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Unread count.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object, properties: { count: { type: integer, example: 3 } } }
 *       401:
 *         description: Missing/invalid access token.
 */
notificationsRouter.get('/unread-count', authenticate(), controller.unreadCount);

/**
 * @openapi
 * /api/v1/notifications/read-all:
 *   patch:
 *     summary: Mark every one of the authenticated user's unread notifications as read
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Notifications marked read.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object, properties: { updatedCount: { type: integer, example: 4 } } }
 *       401:
 *         description: Missing/invalid access token.
 */
notificationsRouter.patch('/read-all', authenticate(), controller.markAllAsRead);

/**
 * @openapi
 * /api/v1/notifications/{id}/read:
 *   patch:
 *     summary: Mark a single notification as read
 *     description: Idempotent — marking an already-read notification read again succeeds unchanged.
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Notification marked read.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object, properties: { notification: { $ref: '#/components/schemas/Notification' } } }
 *       401:
 *         description: Missing/invalid access token.
 *       404:
 *         description: Notification not found (including one that belongs to a different user — never distinguished from "not found").
 */
notificationsRouter.patch(
  '/:id/read',
  authenticate(),
  validateRequest({ params: notificationIdParamSchema }),
  controller.markAsRead,
);

/**
 * @openapi
 * /api/v1/notifications/{id}:
 *   delete:
 *     summary: Delete a notification
 *     description: Hard delete — notifications have no soft-delete/immutable-history requirement.
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Notification deleted.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { nullable: true, example: null }
 *       401:
 *         description: Missing/invalid access token.
 *       404:
 *         description: Notification not found (including one that belongs to a different user).
 */
notificationsRouter.delete(
  '/:id',
  authenticate(),
  validateRequest({ params: notificationIdParamSchema }),
  controller.remove,
);
