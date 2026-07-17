import { Router } from 'express';

import { authenticate, requireRole } from '@modules/auth/auth.middleware';
import { validateRequest } from '@validation/validate-request.middleware';
import { MenuItemsController } from './menu-items.controller';
import {
  canteenIdParamSchema,
  createMenuItemSchema,
  listMenuItemsQuerySchema,
  menuItemIdParamSchema,
  reorderMenuItemSchema,
  updateAvailabilitySchema,
  updateFeaturedSchema,
  updateMenuItemSchema,
} from './menu-items.validation';

export const menuItemsRouter = Router();
const controller = new MenuItemsController();

const MANAGE_ROLES = ['admin', 'super_admin'] as const;

/**
 * @openapi
 * components:
 *   schemas:
 *     MenuItem:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         canteenId: { type: string }
 *         categoryId: { type: string }
 *         name: { type: string }
 *         description: { type: string }
 *         image: { type: string, format: uri }
 *         price: { type: integer, description: "Integer, smallest currency unit (paise). 24900 = ₹249.00." }
 *         preparationTimeMinutes: { type: integer }
 *         isVeg: { type: boolean }
 *         isAvailable: { type: boolean }
 *         isFeatured: { type: boolean }
 *         allergens: { type: array, items: { type: string } }
 *         calories: { type: integer }
 *         displayOrder: { type: integer }
 *         createdBy: { type: string }
 *         updatedBy: { type: string }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 */

/**
 * @openapi
 * /api/v1/canteens/{canteenId}/menu-items:
 *   post:
 *     summary: Create a menu item
 *     description: Admin/Super Admin only. `categoryId` must belong to this canteen and must not be soft-deleted. Item names must be unique within the category (case-insensitive).
 *     tags: [Menu Items]
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
 *             required: [categoryId, name, price, preparationTimeMinutes, isVeg]
 *             properties:
 *               categoryId: { type: string }
 *               name: { type: string, example: "Veg Puff" }
 *               description: { type: string }
 *               image: { type: string, format: uri }
 *               price: { type: integer, example: 3000 }
 *               preparationTimeMinutes: { type: integer, example: 5 }
 *               isVeg: { type: boolean }
 *               isAvailable: { type: boolean, default: true }
 *               isFeatured: { type: boolean, default: false }
 *               allergens: { type: array, items: { type: string } }
 *               calories: { type: integer }
 *               displayOrder: { type: integer, description: "Defaults to appending after the current highest displayOrder within the category." }
 *     responses:
 *       201:
 *         description: Item created.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object, properties: { item: { $ref: '#/components/schemas/MenuItem' } } }
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: Authenticated as a role other than admin/super_admin.
 *       404:
 *         description: Canteen or category not found.
 *       409:
 *         description: An item with this name already exists in this category.
 *       422:
 *         description: The category belongs to a different canteen.
 */
menuItemsRouter.post(
  '/canteens/:canteenId/menu-items',
  authenticate(),
  requireRole(...MANAGE_ROLES),
  validateRequest({ params: canteenIdParamSchema, body: createMenuItemSchema }),
  controller.create,
);

/**
 * @openapi
 * /api/v1/canteens/{canteenId}/menu-items:
 *   get:
 *     summary: List a canteen's menu items
 *     description: Any authenticated role may view. Excludes soft-deleted items.
 *     tags: [Menu Items]
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
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: categoryId
 *         schema: { type: string }
 *       - in: query
 *         name: isVeg
 *         schema: { type: boolean }
 *       - in: query
 *         name: isAvailable
 *         schema: { type: boolean }
 *       - in: query
 *         name: isFeatured
 *         schema: { type: boolean }
 *       - in: query
 *         name: priceMin
 *         schema: { type: integer }
 *       - in: query
 *         name: priceMax
 *         schema: { type: integer }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [name, price, displayOrder, createdAt], default: displayOrder }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: asc }
 *     responses:
 *       200:
 *         description: Paginated item list.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: array, items: { $ref: '#/components/schemas/MenuItem' } }
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
menuItemsRouter.get(
  '/canteens/:canteenId/menu-items',
  authenticate(),
  validateRequest({ params: canteenIdParamSchema, query: listMenuItemsQuerySchema }),
  controller.list,
);

/**
 * @openapi
 * /api/v1/menu-items/{id}:
 *   get:
 *     summary: Get a menu item by id
 *     tags: [Menu Items]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Item found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object, properties: { item: { $ref: '#/components/schemas/MenuItem' } } }
 *       401:
 *         description: Missing/invalid access token.
 *       404:
 *         description: Item not found (or soft-deleted).
 */
menuItemsRouter.get(
  '/menu-items/:id',
  authenticate(),
  validateRequest({ params: menuItemIdParamSchema }),
  controller.getById,
);

/**
 * @openapi
 * /api/v1/menu-items/{id}:
 *   put:
 *     summary: Update a menu item
 *     description: Admin/Super Admin only. Every field optional. `categoryId` may be changed, but only to a category within the item's current canteen. `isAvailable`/`isFeatured`/`displayOrder` are not editable here — use their dedicated endpoints.
 *     tags: [Menu Items]
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
 *               categoryId: { type: string }
 *               name: { type: string }
 *               description: { type: string }
 *               image: { type: string, format: uri }
 *               price: { type: integer }
 *               preparationTimeMinutes: { type: integer }
 *               isVeg: { type: boolean }
 *               allergens: { type: array, items: { type: string } }
 *               calories: { type: integer }
 *     responses:
 *       200:
 *         description: Item updated.
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: Authenticated as a role other than admin/super_admin.
 *       404:
 *         description: Item or target category not found.
 *       409:
 *         description: An item with this name already exists in the target category.
 *       422:
 *         description: The target category belongs to a different canteen.
 */
menuItemsRouter.put(
  '/menu-items/:id',
  authenticate(),
  requireRole(...MANAGE_ROLES),
  validateRequest({ params: menuItemIdParamSchema, body: updateMenuItemSchema }),
  controller.update,
);

/**
 * @openapi
 * /api/v1/menu-items/{id}:
 *   delete:
 *     summary: Delete a menu item (soft delete)
 *     description: Admin/Super Admin only.
 *     tags: [Menu Items]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Item deleted.
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
 *         description: Item not found.
 */
menuItemsRouter.delete(
  '/menu-items/:id',
  authenticate(),
  requireRole(...MANAGE_ROLES),
  validateRequest({ params: menuItemIdParamSchema }),
  controller.remove,
);

/**
 * @openapi
 * /api/v1/menu-items/{id}/availability:
 *   patch:
 *     summary: Set a menu item's availability
 *     description: Admin/Super Admin only. Atomic. Turning availability off also clears isFeatured in the same write — an unavailable item can never remain featured.
 *     tags: [Menu Items]
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
 *             required: [isAvailable]
 *             properties:
 *               isAvailable: { type: boolean }
 *     responses:
 *       200:
 *         description: Availability updated.
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: Authenticated as a role other than admin/super_admin.
 *       404:
 *         description: Item not found.
 */
menuItemsRouter.patch(
  '/menu-items/:id/availability',
  authenticate(),
  requireRole(...MANAGE_ROLES),
  validateRequest({ params: menuItemIdParamSchema, body: updateAvailabilitySchema }),
  controller.updateAvailability,
);

/**
 * @openapi
 * /api/v1/menu-items/{id}/featured:
 *   patch:
 *     summary: Set a menu item's featured flag
 *     description: Admin/Super Admin only. Rejected with 422 if isFeatured=true and the item is not currently available.
 *     tags: [Menu Items]
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
 *             required: [isFeatured]
 *             properties:
 *               isFeatured: { type: boolean }
 *     responses:
 *       200:
 *         description: Featured flag updated.
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: Authenticated as a role other than admin/super_admin.
 *       404:
 *         description: Item not found.
 *       422:
 *         description: The item is not available and cannot be featured.
 */
menuItemsRouter.patch(
  '/menu-items/:id/featured',
  authenticate(),
  requireRole(...MANAGE_ROLES),
  validateRequest({ params: menuItemIdParamSchema, body: updateFeaturedSchema }),
  controller.updateFeatured,
);

/**
 * @openapi
 * /api/v1/menu-items/{id}/reorder:
 *   patch:
 *     summary: Move a menu item to a new position
 *     description: Admin/Super Admin only. `displayOrder` is the target 0-based position among the item's siblings (same category) — every sibling's order is recomputed and persisted atomically.
 *     tags: [Menu Items]
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
 *             required: [displayOrder]
 *             properties:
 *               displayOrder: { type: integer, minimum: 0 }
 *     responses:
 *       200:
 *         description: Item reordered.
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: Authenticated as a role other than admin/super_admin.
 *       404:
 *         description: Item not found.
 */
menuItemsRouter.patch(
  '/menu-items/:id/reorder',
  authenticate(),
  requireRole(...MANAGE_ROLES),
  validateRequest({ params: menuItemIdParamSchema, body: reorderMenuItemSchema }),
  controller.reorder,
);
