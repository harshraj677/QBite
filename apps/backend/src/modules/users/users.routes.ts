import { Router } from 'express';

import { authenticate, requireRole } from '@modules/auth/auth.middleware';
import { validateRequest } from '@validation/validate-request.middleware';
import { UsersController } from './users.controller';
import { userIdParamSchema } from './users.validation';

export const usersRouter = Router();
const controller = new UsersController();

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
