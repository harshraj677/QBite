import { Router } from 'express';

import { authenticate, requireRole } from '@modules/auth/auth.middleware';
import { validateRequest } from '@validation/validate-request.middleware';
import { UsersController } from './users.controller';
import {
  listUsersQuerySchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
  userIdParamSchema,
} from './users.validation';

export const usersRouter = Router();
const controller = new UsersController();

/**
 * @openapi
 * components:
 *   schemas:
 *     PublicUser:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         usn: { type: string }
 *         fullName: { type: string }
 *         collegeEmail: { type: string }
 *         phoneNumber: { type: string }
 *         role: { type: string, enum: [student, kitchen_staff, admin, super_admin] }
 *         isEmailVerified: { type: boolean }
 *         isActive: { type: boolean, description: "Added for the Users Management phase — gates login in auth.middleware.ts; always true for a normal account." }
 *         lastLoginAt: { type: string, format: date-time, description: "Added for the Users Management phase. Absent if the account has never logged in." }
 *         createdAt: { type: string, format: date-time }
 */

/**
 * @openapi
 * /api/v1/users:
 *   get:
 *     summary: Search/list users
 *     description: Admin/super_admin only. Added for the Admin Panel's Users Management phase — the first list/search surface over the `users` collection (every prior endpoint fetched exactly one user). Every filter is a real server-side query param; `search` matches fullName/collegeEmail/usn/phoneNumber case-insensitively.
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
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
 *         name: role
 *         schema: { type: string, enum: [student, kitchen_staff, admin, super_admin] }
 *       - in: query
 *         name: isEmailVerified
 *         schema: { type: string, enum: ["true", "false"] }
 *       - in: query
 *         name: isActive
 *         schema: { type: string, enum: ["true", "false"] }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [fullName, collegeEmail, createdAt, lastLoginAt], default: createdAt }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *     responses:
 *       200:
 *         description: Paginated user list.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: array, items: { $ref: '#/components/schemas/PublicUser' } }
 *                 meta: { type: object, properties: { total: { type: integer }, page: { type: integer }, limit: { type: integer }, hasMore: { type: boolean } } }
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: Authenticated as a role other than admin/super_admin.
 */
usersRouter.get(
  '/',
  authenticate(),
  requireRole('admin', 'super_admin'),
  validateRequest({ query: listUsersQuerySchema }),
  controller.list,
);

/**
 * @openapi
 * /api/v1/users/{id}:
 *   get:
 *     summary: Get a user's public profile by id
 *     description: Admin/super_admin only. Added for the Admin Panel's Operations Center phase — the Order Detail Drawer's Student section needs a real name/email/phone for an order's `studentId`, and no prior phase exposed a general user lookup (only `GET /auth/me`, self-only). Returns the same `PublicUser` shape `/auth/me`/`/auth/register` already return — no new fields, no new exposure surface.
 *     tags: [Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object, properties: { user: { $ref: '#/components/schemas/PublicUser' } } }
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: Authenticated as a role other than admin/super_admin.
 *       404:
 *         description: User not found.
 */
usersRouter.get(
  '/:id',
  authenticate(),
  requireRole('admin', 'super_admin'),
  validateRequest({ params: userIdParamSchema }),
  controller.getById,
);

/**
 * @openapi
 * /api/v1/users/{id}/role:
 *   patch:
 *     summary: Change a user's role
 *     description: Admin/super_admin only. Added for the Users Management phase's Role Management feature. Illegal changes are rejected — a user cannot change their own role (409); only a super_admin may assign or remove the super_admin role (403); demoting the last remaining active super_admin away from that role is rejected (409).
 *     tags: [Users]
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
 *             required: [role]
 *             properties:
 *               role: { type: string, enum: [student, kitchen_staff, admin, super_admin] }
 *     responses:
 *       200:
 *         description: Role updated.
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: Authenticated as a role other than admin/super_admin, or attempting to assign/remove super_admin without holding it.
 *       404:
 *         description: User not found.
 *       409:
 *         description: Self role change, or would leave zero active super_admin accounts.
 */
usersRouter.patch(
  '/:id/role',
  authenticate(),
  requireRole('admin', 'super_admin'),
  validateRequest({ params: userIdParamSchema, body: updateUserRoleSchema }),
  controller.updateRole,
);

/**
 * @openapi
 * /api/v1/users/{id}/status:
 *   patch:
 *     summary: Activate or deactivate a user
 *     description: Admin/super_admin only. Added for the Users Management phase. A deactivated account (`isActive:false`) is immediately rejected by `authenticate()` on its next request. Illegal changes are rejected — a user cannot deactivate/reactivate themselves (409); deactivating the last remaining active admin-capable account (admin/super_admin) is rejected (409).
 *     tags: [Users]
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
 *             required: [isActive]
 *             properties:
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Status updated.
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: Authenticated as a role other than admin/super_admin.
 *       404:
 *         description: User not found.
 *       409:
 *         description: Self status change, or would leave zero active admin-capable accounts.
 */
usersRouter.patch(
  '/:id/status',
  authenticate(),
  requireRole('admin', 'super_admin'),
  validateRequest({ params: userIdParamSchema, body: updateUserStatusSchema }),
  controller.updateStatus,
);
