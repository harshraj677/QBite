import { z } from 'zod';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from './canteens.constants';

/**
 * Field-level *format* validation lives here (Zod, at the request
 * boundary) — cross-field *business* rules (closing time after
 * opening time, name uniqueness) live in CanteensService. See the
 * module-level comment in canteen.model.ts for why format rules
 * aren't duplicated at the Mongoose schema layer too.
 */

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/; // 24-hour HH:mm

const nameSchema = z.string().trim().min(2, 'Name must be at least 2 characters.').max(120);
const descriptionSchema = z.string().trim().max(1000).optional();
const locationSchema = z.string().trim().min(2, 'Location is required.').max(200);
const imageSchema = z.string().trim().url('Image must be a valid URL.').optional();
const contactNumberSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{10,15}$/, 'Invalid contact number.');
const emailSchema = z.string().trim().toLowerCase().email('Invalid email address.');
const openingTimeSchema = z
  .string()
  .regex(TIME_PATTERN, 'openingTime must be in 24-hour HH:mm format.');
const closingTimeSchema = z
  .string()
  .regex(TIME_PATTERN, 'closingTime must be in 24-hour HH:mm format.');

export const createCanteenSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  location: locationSchema,
  image: imageSchema,
  contactNumber: contactNumberSchema,
  email: emailSchema,
  openingTime: openingTimeSchema,
  closingTime: closingTimeSchema,
});
export type CreateCanteenInput = z.infer<typeof createCanteenSchema>;

// PUT /canteens/:id is used as an edit endpoint (every field
// optional), not REST-purist full-replace semantics — createdBy/
// isOpen/soft-delete state are never client-editable through this
// route regardless. At least one field must be present, or there's
// nothing to update.
export const updateCanteenSchema = createCanteenSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided.',
  });
export type UpdateCanteenInput = z.infer<typeof updateCanteenSchema>;

export const canteenIdParamSchema = z.object({
  id: z.string().regex(OBJECT_ID_PATTERN, 'Invalid canteen id.'),
});
export type CanteenIdParam = z.infer<typeof canteenIdParamSchema>;

// Query params always arrive as strings — z.coerce/transform turns
// them into the typed values the service layer actually wants.
export const listCanteensQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  isOpen: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  sortBy: z.enum(['name', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type ListCanteensQuery = z.infer<typeof listCanteensQuerySchema>;
