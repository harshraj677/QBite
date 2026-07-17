import { Router } from 'express';

import { authenticate, requireRole } from '@modules/auth/auth.middleware';
import { validateRequest } from '@validation/validate-request.middleware';
import { MenuCategoriesController } from './menu-categories.controller';
import {
  canteenIdParamSchema,
  categoryIdParamSchema,
  createMenuCategorySchema,
  deleteMenuCategoryQuerySchema,
  listMenuCategoriesQuerySchema,
  reorderMenuCategorySchema,
  updateMenuCategorySchema,
} from './menu-categories.validation';

export const menuCategoriesRouter = Router();
const controller = new MenuCategoriesController();

const MANAGE_ROLES = ['admin', 'super_admin'] as const;

/**
 * @openapi
 * components:
 *   schemas:
 *     MenuCategory:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         canteenId: { type: string }
 *         name: { type: string }
 *         description: { type: string }
 *         displayOrder: { type: integer }
 *         isActive: { type: boolean }
 *         createdBy: { type: string }
 *         updatedBy: { type: string }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 */

/**
 * @openapi
 * /api/v1/canteens/{canteenId}/categories:
 *   post:
 *     summary: Create a menu category
 *     description: Admin/Super Admin only. Category names must be unique within the canteen (case-insensitive).
 *     tags: [Menu Categories]
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
 *             required: [name]
 *             properties:
 *               name: { type: string, example: "Snacks" }
 *               description: { type: string }
 *               displayOrder: { type: integer, description: "Defaults to appending after the current highest displayOrder." }
 *     responses:
 *       201:
 *         description: Category created.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object, properties: { category: { $ref: '#/components/schemas/MenuCategory' } } }
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: Authenticated as a role other than admin/super_admin.
 *       404:
 *         description: Canteen not found.
 *       409:
 *         description: A category with this name already exists in this canteen.
 */
menuCategoriesRouter.post(
  '/canteens/:canteenId/categories',
  authenticate(),
  requireRole(...MANAGE_ROLES),
  validateRequest({ params: canteenIdParamSchema, body: createMenuCategorySchema }),
  controller.create,
);

/**
 * @openapi
 * /api/v1/canteens/{canteenId}/categories:
 *   get:
 *     summary: List a canteen's menu categories
 *     description: Any authenticated role may view. Excludes soft-deleted categories.
 *     tags: [Menu Categories]
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
 *         name: isActive
 *         schema: { type: boolean }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [name, displayOrder, createdAt], default: displayOrder }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: asc }
 *     responses:
 *       200:
 *         description: Paginated category list.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: array, items: { $ref: '#/components/schemas/MenuCategory' } }
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
menuCategoriesRouter.get(
  '/canteens/:canteenId/categories',
  authenticate(),
  validateRequest({ params: canteenIdParamSchema, query: listMenuCategoriesQuerySchema }),
  controller.list,
);

/**
 * @openapi
 * /api/v1/categories/{id}:
 *   get:
 *     summary: Get a menu category by id
 *     tags: [Menu Categories]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Category found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object, properties: { category: { $ref: '#/components/schemas/MenuCategory' } } }
 *       401:
 *         description: Missing/invalid access token.
 *       404:
 *         description: Category not found (or soft-deleted).
 */
menuCategoriesRouter.get(
  '/categories/:id',
  authenticate(),
  validateRequest({ params: categoryIdParamSchema }),
  controller.getById,
);

/**
 * @openapi
 * /api/v1/categories/{id}:
 *   put:
 *     summary: Update a menu category
 *     description: Admin/Super Admin only. Every field optional (edit semantics) — at least one must be provided. `displayOrder` is not editable here; use PATCH /categories/{id}/reorder.
 *     tags: [Menu Categories]
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
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Category updated.
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: Authenticated as a role other than admin/super_admin.
 *       404:
 *         description: Category not found.
 *       409:
 *         description: A category with this name already exists in this canteen.
 */
menuCategoriesRouter.put(
  '/categories/:id',
  authenticate(),
  requireRole(...MANAGE_ROLES),
  validateRequest({ params: categoryIdParamSchema, body: updateMenuCategorySchema }),
  controller.update,
);

/**
 * @openapi
 * /api/v1/categories/{id}:
 *   delete:
 *     summary: Delete a menu category (soft delete)
 *     description: Admin/Super Admin only. Rejected with 409 if the category still has active items, unless force=true — in which case the category and every one of its active items are soft-deleted together.
 *     tags: [Menu Categories]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: force
 *         schema: { type: boolean, default: false }
 *     responses:
 *       200:
 *         description: Category deleted.
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
 *         description: Category not found.
 *       409:
 *         description: The category still has active items and force was not set.
 */
menuCategoriesRouter.delete(
  '/categories/:id',
  authenticate(),
  requireRole(...MANAGE_ROLES),
  validateRequest({ params: categoryIdParamSchema, query: deleteMenuCategoryQuerySchema }),
  controller.remove,
);

/**
 * @openapi
 * /api/v1/categories/{id}/reorder:
 *   patch:
 *     summary: Move a menu category to a new position
 *     description: Admin/Super Admin only. `displayOrder` is the target 0-based position among the category's siblings (same canteen) — every sibling's order is recomputed and persisted atomically.
 *     tags: [Menu Categories]
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
 *         description: Category reordered.
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: Authenticated as a role other than admin/super_admin.
 *       404:
 *         description: Category not found.
 */
menuCategoriesRouter.patch(
  '/categories/:id/reorder',
  authenticate(),
  requireRole(...MANAGE_ROLES),
  validateRequest({ params: categoryIdParamSchema, body: reorderMenuCategorySchema }),
  controller.reorder,
);
