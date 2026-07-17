import { Router } from 'express';

import { authenticate, requireRole } from '@modules/auth/auth.middleware';
import { validateRequest } from '@validation/validate-request.middleware';
import { OrdersController } from './orders.controller';
import {
  cancelOrderSchema,
  canteenIdParamSchema,
  createOrderSchema,
  listCanteenOrdersQuerySchema,
  listMyOrdersQuerySchema,
  orderIdParamSchema,
  updateOrderStatusSchema,
} from './orders.validation';

export const ordersRouter = Router();
const controller = new OrdersController();

const KITCHEN_ROLES = ['kitchen_staff', 'admin', 'super_admin'] as const;
const CANCEL_ROLES = ['student', 'admin', 'super_admin'] as const;

/**
 * @openapi
 * components:
 *   schemas:
 *     OrderItem:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         orderId: { type: string }
 *         menuItemId: { type: string }
 *         quantity: { type: integer }
 *         unitPrice: { type: integer, description: "Integer, paise, frozen at order time." }
 *         totalPrice: { type: integer }
 *         notes: { type: string }
 *         itemSnapshot:
 *           type: object
 *           description: Immutable copy of the menu item as it was when ordered — never affected by later menu edits.
 *           properties:
 *             itemId: { type: string }
 *             itemName: { type: string }
 *             categoryName: { type: string }
 *             image: { type: string, format: uri }
 *             unitPrice: { type: integer }
 *             isVeg: { type: boolean }
 *     Order:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         orderNumber: { type: string, example: "QB-2026-A1B2C3D4" }
 *         canteenId: { type: string }
 *         studentId: { type: string }
 *         status: { type: string, enum: [pending, accepted, preparing, ready, completed, cancelled] }
 *         paymentStatus: { type: string, enum: [pending, paid, failed, refunded] }
 *         paymentMethod: { type: string, enum: [cash, online] }
 *         subtotal: { type: integer, description: "Integer, paise." }
 *         tax: { type: integer }
 *         discount: { type: integer }
 *         totalAmount: { type: integer }
 *         pickupToken: { type: string, example: "482913" }
 *         estimatedReadyTimeMinutes: { type: integer }
 *         notes: { type: string }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *         acceptedAt: { type: string, format: date-time }
 *         preparingAt: { type: string, format: date-time }
 *         readyAt: { type: string, format: date-time }
 *         completedAt: { type: string, format: date-time }
 *         cancelledAt: { type: string, format: date-time }
 *         cancellationReason: { type: string }
 *     OrderWithItems:
 *       allOf:
 *         - $ref: '#/components/schemas/Order'
 *         - type: object
 *           properties:
 *             items:
 *               type: array
 *               items: { $ref: '#/components/schemas/OrderItem' }
 */

/**
 * @openapi
 * /api/v1/canteens/{canteenId}/orders:
 *   post:
 *     summary: Place an order
 *     description: Student only. Server computes subtotal/tax/discount/totalAmount from live menu-item prices — any client-sent totalAmount is ignored. Every item must be available and belong to this canteen.
 *     tags: [Orders]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: canteenId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items, paymentMethod]
 *             properties:
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [menuItemId, quantity]
 *                   properties:
 *                     menuItemId: { type: string }
 *                     quantity: { type: integer, minimum: 1 }
 *                     notes: { type: string }
 *               paymentMethod: { type: string, enum: [cash, online] }
 *               notes: { type: string }
 *     responses:
 *       201:
 *         description: Order placed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object, properties: { order: { $ref: '#/components/schemas/OrderWithItems' } } }
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: Authenticated as a role other than student.
 *       404:
 *         description: Canteen or a referenced menu item not found.
 *       422:
 *         description: A menu item is unavailable or belongs to a different canteen.
 */
ordersRouter.post(
  '/canteens/:canteenId/orders',
  authenticate(),
  requireRole('student'),
  validateRequest({ params: canteenIdParamSchema, body: createOrderSchema }),
  controller.create,
);

/**
 * @openapi
 * /api/v1/orders/{id}:
 *   get:
 *     summary: Get an order by id, including its items
 *     description: A student may only view their own orders (403 otherwise). Kitchen staff/admin/super_admin may view any order.
 *     tags: [Orders]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Order found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object, properties: { order: { $ref: '#/components/schemas/OrderWithItems' } } }
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: A student requesting an order that isn't theirs.
 *       404:
 *         description: Order not found.
 */
ordersRouter.get(
  '/orders/:id',
  authenticate(),
  validateRequest({ params: orderIdParamSchema }),
  controller.getById,
);

/**
 * @openapi
 * /api/v1/students/me/orders:
 *   get:
 *     summary: List the authenticated student's own order history
 *     tags: [Orders]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 50 }
 *       - in: query
 *         name: orderNumber
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, accepted, preparing, ready, completed, cancelled] }
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [createdAt, totalAmount], default: createdAt }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *     responses:
 *       200:
 *         description: Paginated order list (without items — fetch GET /orders/{id} for line-item detail).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: array, items: { $ref: '#/components/schemas/Order' } }
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     hasMore: { type: boolean }
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: Authenticated as a role other than student.
 */
ordersRouter.get(
  '/students/me/orders',
  authenticate(),
  requireRole('student'),
  validateRequest({ query: listMyOrdersQuerySchema }),
  controller.listMine,
);

/**
 * @openapi
 * /api/v1/canteens/{canteenId}/orders:
 *   get:
 *     summary: List a canteen's orders (kitchen queue view)
 *     description: Kitchen staff/admin/super_admin only. No per-canteen staff assignment exists yet — any kitchen_staff account may view any canteen's orders (documented limitation, see ARCHITECTURE.md §3.1).
 *     tags: [Orders]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: canteenId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 50 }
 *       - in: query
 *         name: orderNumber
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, accepted, preparing, ready, completed, cancelled] }
 *       - in: query
 *         name: studentId
 *         schema: { type: string }
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [createdAt, totalAmount], default: createdAt }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *     responses:
 *       200:
 *         description: Paginated order list.
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: Authenticated as a student.
 */
ordersRouter.get(
  '/canteens/:canteenId/orders',
  authenticate(),
  requireRole(...KITCHEN_ROLES),
  validateRequest({ params: canteenIdParamSchema, query: listCanteenOrdersQuerySchema }),
  controller.listForCanteen,
);

/**
 * @openapi
 * /api/v1/orders/{id}/status:
 *   patch:
 *     summary: Advance an order to the next lifecycle status
 *     description: Kitchen staff/admin/super_admin only. Forward-only (pending→accepted→preparing→ready→completed) — skipping a stage, repeating the current stage, or targeting `cancelled` here all fail with 409/400. Use PATCH /orders/{id}/cancel to cancel.
 *     tags: [Orders]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [accepted, preparing, ready, completed] }
 *     responses:
 *       200:
 *         description: Status updated.
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: Authenticated as a student.
 *       404:
 *         description: Order not found.
 *       409:
 *         description: The requested status is not a valid next step from the order's current status.
 */
ordersRouter.patch(
  '/orders/:id/status',
  authenticate(),
  requireRole(...KITCHEN_ROLES),
  validateRequest({ params: orderIdParamSchema, body: updateOrderStatusSchema }),
  controller.updateStatus,
);

/**
 * @openapi
 * /api/v1/orders/{id}/cancel:
 *   patch:
 *     summary: Cancel an order
 *     description: A student may cancel only their own order, and only while it is still `pending`. Admin/super_admin may cancel any order that hasn't reached a terminal state (completed/cancelled). Kitchen staff cannot cancel.
 *     tags: [Orders]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cancellationReason: { type: string }
 *     responses:
 *       200:
 *         description: Order cancelled.
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: A student attempting to cancel another student's order, or a kitchen_staff account.
 *       404:
 *         description: Order not found.
 *       409:
 *         description: The order is no longer in a cancellable status.
 */
ordersRouter.patch(
  '/orders/:id/cancel',
  authenticate(),
  requireRole(...CANCEL_ROLES),
  validateRequest({ params: orderIdParamSchema, body: cancelOrderSchema }),
  controller.cancel,
);
