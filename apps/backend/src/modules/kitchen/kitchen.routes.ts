import { Router } from 'express';

import { authenticate, requireRole } from '@modules/auth/auth.middleware';
import { validateRequest } from '@validation/validate-request.middleware';
import { KitchenController } from './kitchen.controller';
import { kitchenOrderIdParamSchema, listKitchenOrdersQuerySchema } from './kitchen.validation';

export const kitchenRouter = Router();
const controller = new KitchenController();

/**
 * kitchen_staff/admin/super_admin only — students have no access to
 * any endpoint in this router. Mounted at `/kitchen` (a plain prefix,
 * unlike `menu`/`orders`'s root-mount) since every route here lives
 * entirely under that one segment, with no path-shape mixing to work
 * around.
 */
const KITCHEN_ROLES = ['kitchen_staff', 'admin', 'super_admin'] as const;

/**
 * @openapi
 * /api/v1/kitchen/orders:
 *   get:
 *     summary: Kitchen dashboard — list orders across every canteen
 *     description: kitchen_staff/admin/super_admin only. Unscoped by canteen (no kitchen_staff-to-canteen assignment exists yet — see ARCHITECTURE.md §3.1). `status=pending` is the "incoming orders" view; `preparing`/`ready`/`completed` map directly to their own dashboard views. `paymentStatus`/`studentId`/`canteenId`/`dateFrom`/`dateTo`/`minAmount`/`maxAmount` were added for the Admin Panel's Operations Center — every one is a real, server-side filter (not a client-side post-filter over one page), so any combination returns the true matching set across every canteen. `includeItems` was added for the Kitchen Operations Center — a Kitchen Display System's board shows each order's items directly on its card.
 *     tags: [Kitchen]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 50 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, accepted, preparing, ready, completed, cancelled] }
 *       - in: query
 *         name: paymentStatus
 *         schema: { type: string, enum: [pending, paid, failed, refunded] }
 *       - in: query
 *         name: paymentMethod
 *         description: Added for the Payments Management phase.
 *         schema: { type: string, enum: [cash, online] }
 *       - in: query
 *         name: orderNumber
 *         schema: { type: string }
 *       - in: query
 *         name: pickupToken
 *         schema: { type: string, example: "482913" }
 *       - in: query
 *         name: studentId
 *         schema: { type: string }
 *       - in: query
 *         name: canteenId
 *         schema: { type: string }
 *       - in: query
 *         name: dateFrom
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: dateTo
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: minAmount
 *         description: Inclusive lower bound on totalAmount, paise.
 *         schema: { type: integer }
 *       - in: query
 *         name: maxAmount
 *         description: Inclusive upper bound on totalAmount, paise.
 *         schema: { type: integer }
 *       - in: query
 *         name: includeItems
 *         description: When "true", each order in the response carries its line items (see the Payment/Order schemas) — one batched query for the whole page, not one per order.
 *         schema: { type: string, enum: [true, false], default: "false" }
 *       - in: query
 *         name: sortOrder
 *         description: "asc = oldest first, desc = newest first"
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *     responses:
 *       200:
 *         description: Paginated order list. Items are omitted unless `includeItems=true` — see GET /kitchen/orders/{id} for single-order line-item detail otherwise.
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
 *         description: Authenticated as a student.
 */
kitchenRouter.get(
  '/orders',
  authenticate(),
  requireRole(...KITCHEN_ROLES),
  validateRequest({ query: listKitchenOrdersQuerySchema }),
  controller.list,
);

/**
 * @openapi
 * /api/v1/kitchen/orders/{id}:
 *   get:
 *     summary: Get an order by id, including its items
 *     description: kitchen_staff/admin/super_admin only. Identical data to GET /orders/{id} — this route exists so kitchen tooling doesn't need to depend on the student-facing order routes.
 *     tags: [Kitchen]
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
 *         description: Authenticated as a student.
 *       404:
 *         description: Order not found.
 */
kitchenRouter.get(
  '/orders/:id',
  authenticate(),
  requireRole(...KITCHEN_ROLES),
  validateRequest({ params: kitchenOrderIdParamSchema }),
  controller.getById,
);

/**
 * @openapi
 * /api/v1/kitchen/orders/{id}/accept:
 *   patch:
 *     summary: Accept a pending order (pending → accepted)
 *     description: kitchen_staff/admin/super_admin only. No request body — delegates to the same OrdersService.updateStatus that backs PATCH /orders/{id}/status, so the same atomic transition guard and audit logging apply.
 *     tags: [Kitchen]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Order accepted.
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: Authenticated as a student.
 *       404:
 *         description: Order not found.
 *       409:
 *         description: The order is not currently pending.
 */
kitchenRouter.patch(
  '/orders/:id/accept',
  authenticate(),
  requireRole(...KITCHEN_ROLES),
  validateRequest({ params: kitchenOrderIdParamSchema }),
  controller.accept,
);

/**
 * @openapi
 * /api/v1/kitchen/orders/{id}/start-preparing:
 *   patch:
 *     summary: Start preparing an accepted order (accepted → preparing)
 *     description: kitchen_staff/admin/super_admin only. No request body.
 *     tags: [Kitchen]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Order now preparing.
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: Authenticated as a student.
 *       404:
 *         description: Order not found.
 *       409:
 *         description: The order is not currently accepted.
 */
kitchenRouter.patch(
  '/orders/:id/start-preparing',
  authenticate(),
  requireRole(...KITCHEN_ROLES),
  validateRequest({ params: kitchenOrderIdParamSchema }),
  controller.startPreparing,
);

/**
 * @openapi
 * /api/v1/kitchen/orders/{id}/ready:
 *   patch:
 *     summary: Mark an order ready for pickup (preparing → ready)
 *     description: kitchen_staff/admin/super_admin only. No request body.
 *     tags: [Kitchen]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Order now ready.
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: Authenticated as a student.
 *       404:
 *         description: Order not found.
 *       409:
 *         description: The order is not currently preparing.
 */
kitchenRouter.patch(
  '/orders/:id/ready',
  authenticate(),
  requireRole(...KITCHEN_ROLES),
  validateRequest({ params: kitchenOrderIdParamSchema }),
  controller.markReady,
);

/**
 * @openapi
 * /api/v1/kitchen/orders/{id}/complete:
 *   patch:
 *     summary: Complete a picked-up order (ready → completed)
 *     description: kitchen_staff/admin/super_admin only. No request body. The order becomes immutable once completed.
 *     tags: [Kitchen]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Order completed.
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: Authenticated as a student.
 *       404:
 *         description: Order not found.
 *       409:
 *         description: The order is not currently ready.
 */
kitchenRouter.patch(
  '/orders/:id/complete',
  authenticate(),
  requireRole(...KITCHEN_ROLES),
  validateRequest({ params: kitchenOrderIdParamSchema }),
  controller.completePickup,
);
