import { z } from 'zod';

import { objectIdSchema } from '@validation/common.schemas';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './menu.constants';

/**
 * Field-level *format* validation lives here (Zod, at the request
 * boundary) — cross-field *business* rules (name uniqueness within a
 * canteen, delete-with-active-items guard) live in
 * MenuCategoriesService. Same split as canteens.validation.ts.
 */

const nameSchema = z.string().trim().min(2, 'Name must be at least 2 characters.').max(120);
const descriptionSchema = z.string().trim().max(1000).optional();
const displayOrderSchema = z.coerce.number().int().min(0).optional();

export const createMenuCategorySchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  displayOrder: displayOrderSchema,
});
export type CreateMenuCategoryInput = z.infer<typeof createMenuCategorySchema>;

// PUT /categories/:id is an edit endpoint (every field optional), same
// convention as canteens.validation.ts's updateCanteenSchema.
// `displayOrder` is deliberately excluded — PATCH /categories/:id/reorder
// is the sole path that changes it, so every sibling's order is always
// recomputed together and two categories can never end up sharing a
// position via an uncoordinated PUT edit.
export const updateMenuCategorySchema = z
  .object({
    name: nameSchema.optional(),
    description: descriptionSchema,
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided.',
  });
export type UpdateMenuCategoryInput = z.infer<typeof updateMenuCategorySchema>;

export const reorderMenuCategorySchema = z.object({
  displayOrder: z.coerce.number().int().min(0),
});
export type ReorderMenuCategoryInput = z.infer<typeof reorderMenuCategorySchema>;

export const canteenIdParamSchema = z.object({
  canteenId: objectIdSchema,
});
export type CanteenIdParam = z.infer<typeof canteenIdParamSchema>;

export const categoryIdParamSchema = z.object({
  id: objectIdSchema,
});
export type CategoryIdParam = z.infer<typeof categoryIdParamSchema>;

export const listMenuCategoriesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  search: z.string().trim().min(1).optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  sortBy: z.enum(['name', 'displayOrder', 'createdAt']).default('displayOrder'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});
export type ListMenuCategoriesQuery = z.infer<typeof listMenuCategoriesQuerySchema>;

/** `force=true` bypasses the "category has active items" delete guard — see MenuCategoriesService.deleteCategory. */
export const deleteMenuCategoryQuerySchema = z.object({
  force: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});
export type DeleteMenuCategoryQuery = z.infer<typeof deleteMenuCategoryQuerySchema>;
