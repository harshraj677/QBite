import { z } from 'zod';

import { objectIdSchema } from '@validation/common.schemas';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, USER_SORTABLE_FIELDS } from './users.constants';
import { USER_ROLES } from './user.types';

export const userIdParamSchema = z.object({
  id: objectIdSchema,
});
export type UserIdParam = z.infer<typeof userIdParamSchema>;

/**
 * `"true"`/`"false"` string literals, not `z.coerce.boolean()` —
 * `Boolean("false") === true` in JS, so coercion would silently turn
 * `?isActive=false` into `true`. Same fix, same reasoning, as
 * kitchen.validation.ts's `includeItems` (see that file's doc comment
 * for the full story of how this was caught).
 */
const booleanQueryParam = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === 'true'));

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  search: z.string().trim().min(1).optional(),
  role: z.enum(USER_ROLES).optional(),
  isEmailVerified: booleanQueryParam,
  isActive: booleanQueryParam,
  sortBy: z.enum(USER_SORTABLE_FIELDS).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const updateUserRoleSchema = z.object({
  role: z.enum(USER_ROLES),
});
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

export const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
});
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
