import { Router } from 'express';

import { authenticate, requireRole } from '@modules/auth/auth.middleware';
import { validateRequest } from '@validation/validate-request.middleware';
import { CanteensController } from './canteens.controller';
import {
  canteenIdParamSchema,
  createCanteenSchema,
  listCanteensQuerySchema,
  updateCanteenSchema,
} from './canteens.validation';

export const canteensRouter = Router();
const controller = new CanteensController();

const MANAGE_ROLES = ['admin', 'super_admin'] as const;

/**
 * @openapi
 * components:
 *   schemas:
 *     Canteen:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         name: { type: string }
 *         description: { type: string }
 *         location: { type: string }
 *         image: { type: string, format: uri }
 *         contactNumber: { type: string }
 *         email: { type: string, format: email }
 *         openingTime: { type: string, example: "09:00" }
 *         closingTime: { type: string, example: "21:00" }
 *         isOpen: { type: boolean }
 *         createdBy: { type: string }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 */

/**
 * @openapi
 * /api/v1/canteens:
 *   post:
 *     summary: Create a canteen
 *     description: Admin/Super Admin only. `createdBy` is always the authenticated caller — never client-supplied.
 *     tags: [Canteens]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, location, contactNumber, email, openingTime, closingTime]
 *             properties:
 *               name: { type: string, example: "Main Canteen" }
 *               description: { type: string }
 *               location: { type: string, example: "Block A, Ground Floor" }
 *               image: { type: string, format: uri }
 *               contactNumber: { type: string, example: "+919876543210" }
 *               email: { type: string, format: email }
 *               openingTime: { type: string, example: "09:00" }
 *               closingTime: { type: string, example: "21:00" }
 *     responses:
 *       201:
 *         description: Canteen created.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object, properties: { canteen: { $ref: '#/components/schemas/Canteen' } } }
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: Authenticated as a role other than admin/super_admin.
 *       409:
 *         description: A canteen with this name already exists.
 *       422:
 *         description: closingTime is not after openingTime.
 */
canteensRouter.post(
  '/',
  authenticate(),
  requireRole(...MANAGE_ROLES),
  validateRequest({ body: createCanteenSchema }),
  controller.create,
);

/**
 * @openapi
 * /api/v1/canteens:
 *   get:
 *     summary: List canteens
 *     description: Any authenticated role may view. Excludes soft-deleted canteens.
 *     tags: [Canteens]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 50 }
 *       - in: query
 *         name: isOpen
 *         schema: { type: boolean }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [name, createdAt], default: createdAt }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *     responses:
 *       200:
 *         description: Paginated canteen list.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: array, items: { $ref: '#/components/schemas/Canteen' } }
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
canteensRouter.get(
  '/',
  authenticate(),
  validateRequest({ query: listCanteensQuerySchema }),
  controller.list,
);

/**
 * @openapi
 * /api/v1/canteens/{id}:
 *   get:
 *     summary: Get a canteen by id
 *     tags: [Canteens]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Canteen found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object, properties: { canteen: { $ref: '#/components/schemas/Canteen' } } }
 *       401:
 *         description: Missing/invalid access token.
 *       404:
 *         description: Canteen not found (or soft-deleted).
 */
canteensRouter.get(
  '/:id',
  authenticate(),
  validateRequest({ params: canteenIdParamSchema }),
  controller.getById,
);

/**
 * @openapi
 * /api/v1/canteens/{id}:
 *   put:
 *     summary: Update a canteen
 *     description: Admin/Super Admin only. Every field optional (edit semantics) — at least one must be provided.
 *     tags: [Canteens]
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
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               location: { type: string }
 *               image: { type: string, format: uri }
 *               contactNumber: { type: string }
 *               email: { type: string, format: email }
 *               openingTime: { type: string }
 *               closingTime: { type: string }
 *     responses:
 *       200:
 *         description: Canteen updated.
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: Authenticated as a role other than admin/super_admin.
 *       404:
 *         description: Canteen not found.
 *       409:
 *         description: A canteen with this name already exists.
 *       422:
 *         description: The effective closingTime is not after the effective openingTime.
 */
canteensRouter.put(
  '/:id',
  authenticate(),
  requireRole(...MANAGE_ROLES),
  validateRequest({ params: canteenIdParamSchema, body: updateCanteenSchema }),
  controller.update,
);

/**
 * @openapi
 * /api/v1/canteens/{id}:
 *   delete:
 *     summary: Delete a canteen (soft delete)
 *     description: Admin/Super Admin only. Sets isDeleted/deletedAt/deletedBy rather than removing the document — the canteen becomes invisible to every read endpoint but is not permanently destroyed.
 *     tags: [Canteens]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Canteen deleted.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { nullable: true, example: null }
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: Authenticated as a role other than admin/super_admin.
 *       404:
 *         description: Canteen not found.
 */
canteensRouter.delete(
  '/:id',
  authenticate(),
  requireRole(...MANAGE_ROLES),
  validateRequest({ params: canteenIdParamSchema }),
  controller.remove,
);

/**
 * @openapi
 * /api/v1/canteens/{id}/status:
 *   patch:
 *     summary: Toggle a canteen's open/closed status
 *     description: Admin/Super Admin only. Flips isOpen atomically — no request body.
 *     tags: [Canteens]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Status toggled.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object, properties: { canteen: { $ref: '#/components/schemas/Canteen' } } }
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: Authenticated as a role other than admin/super_admin.
 *       404:
 *         description: Canteen not found.
 */
canteensRouter.patch(
  '/:id/status',
  authenticate(),
  requireRole(...MANAGE_ROLES),
  validateRequest({ params: canteenIdParamSchema }),
  controller.toggleStatus,
);
