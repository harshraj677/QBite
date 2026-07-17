import { z } from 'zod';

import { objectIdSchema } from '@validation/common.schemas';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './menu.constants';

/**
 * Field-level *format* validation lives here (Zod, at the request
 * boundary) — cross-field *business* rules (name uniqueness within a
 * category, category-belongs-to-same-canteen, featured/availability
 * consistency) live in MenuItemsService. Same split as
 * canteens.validation.ts / menu-categories.validation.ts.
 */

const nameSchema = z.string().trim().min(2, 'Name must be at least 2 characters.').max(150);
const descriptionSchema = z.string().trim().max(1000).optional();
const imageSchema = z.string().trim().url('Image must be a valid URL.').optional();
// Integer paise — docs/DATABASE_DESIGN.md §6's money convention. z.coerce
// so a client sending "3000" (form-encoded) still parses.
const priceSchema = z.coerce.number().int().positive('price must be a positive integer (paise).');
const preparationTimeSchema = z.coerce
  .number()
  .int()
  .positive('preparationTimeMinutes must be a positive integer.');
const allergensSchema = z.array(z.string().trim().min(1).max(40)).max(20).optional();
const caloriesSchema = z.coerce.number().int().min(0).optional();
const displayOrderSchema = z.coerce.number().int().min(0).optional();

export const createMenuItemSchema = z.object({
  categoryId: objectIdSchema,
  name: nameSchema,
  description: descriptionSchema,
  image: imageSchema,
  price: priceSchema,
  preparationTimeMinutes: preparationTimeSchema,
  isVeg: z.boolean(),
  isAvailable: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  allergens: allergensSchema,
  calories: caloriesSchema,
  displayOrder: displayOrderSchema,
});
export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;

// PUT /menu-items/:id is an edit endpoint (every field optional).
// `categoryId` IS editable here (moving an item between categories in
// the same canteen is a supported business rule — see
// MenuItemsService.updateItem) — unlike menu-categories, `displayOrder`
// is still excluded, reserved for PATCH /menu-items/:id/reorder, and
// `isAvailable`/`isFeatured` are excluded too, reserved for their own
// dedicated PATCH endpoints so each has one atomic, auditable path.
export const updateMenuItemSchema = z
  .object({
    categoryId: objectIdSchema.optional(),
    name: nameSchema.optional(),
    description: descriptionSchema,
    image: imageSchema,
    price: priceSchema.optional(),
    preparationTimeMinutes: preparationTimeSchema.optional(),
    isVeg: z.boolean().optional(),
    allergens: allergensSchema,
    calories: caloriesSchema,
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided.',
  });
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;

export const updateAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
});
export type UpdateAvailabilityInput = z.infer<typeof updateAvailabilitySchema>;

export const updateFeaturedSchema = z.object({
  isFeatured: z.boolean(),
});
export type UpdateFeaturedInput = z.infer<typeof updateFeaturedSchema>;

export const reorderMenuItemSchema = z.object({
  displayOrder: z.coerce.number().int().min(0),
});
export type ReorderMenuItemInput = z.infer<typeof reorderMenuItemSchema>;

export const canteenIdParamSchema = z.object({
  canteenId: objectIdSchema,
});
export type CanteenIdParam = z.infer<typeof canteenIdParamSchema>;

export const menuItemIdParamSchema = z.object({
  id: objectIdSchema,
});
export type MenuItemIdParam = z.infer<typeof menuItemIdParamSchema>;

const booleanQueryParam = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === 'true'));

export const listMenuItemsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    search: z.string().trim().min(1).optional(),
    categoryId: objectIdSchema.optional(),
    isVeg: booleanQueryParam,
    isAvailable: booleanQueryParam,
    isFeatured: booleanQueryParam,
    priceMin: z.coerce.number().int().nonnegative().optional(),
    priceMax: z.coerce.number().int().nonnegative().optional(),
    sortBy: z.enum(['name', 'price', 'displayOrder', 'createdAt']).default('displayOrder'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  })
  .refine(
    (data) =>
      data.priceMin === undefined || data.priceMax === undefined || data.priceMin <= data.priceMax,
    {
      message: 'priceMin must not be greater than priceMax.',
      path: ['priceMin'],
    },
  );
export type ListMenuItemsQuery = z.infer<typeof listMenuItemsQuerySchema>;
