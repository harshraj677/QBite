import { z } from 'zod';

import { objectIdSchema } from '@validation/common.schemas';
import { ORDER_STATUSES } from '@modules/orders/order.types';

/**
 * Field-level *format* validation lives here (Zod, at the request
 * boundary) — this module has no business rules of its own to
 * validate against (see kitchen.service.ts's doc comment: every
 * mutation is a pure delegation to OrdersService, which already owns
 * and enforces all order business rules).
 *
 * Pagination defaults are duplicated here rather than imported from
 * `orders.constants.ts` — same rationale `menu.constants.ts` gives for
 * not importing `canteens.constants.ts`'s: keeps this module
 * independent, and the two numbers are pure config with no
 * correctness risk if they ever drift.
 *
 * `ORDER_STATUSES`, by contrast, *is* imported from `order.types.ts`
 * (a types-only file, no model/repository access) — this is shared
 * domain vocabulary, not module-local config, so duplicating the
 * literal string array here would risk silent drift if Orders ever
 * adds a status.
 */

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export const kitchenOrderIdParamSchema = z.object({
  id: objectIdSchema,
});
export type KitchenOrderIdParam = z.infer<typeof kitchenOrderIdParamSchema>;

// No `sortBy` choice — the kitchen dashboard only ever sorts by time
// ("oldest first" / "newest first" per the phase spec), unlike the
// direct Orders API's createdAt/totalAmount choice.
export const listKitchenOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  status: z.enum(ORDER_STATUSES).optional(),
  orderNumber: z.string().trim().min(1).optional(),
  pickupToken: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'pickupToken must be a 6-digit code.')
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
export type ListKitchenOrdersQuery = z.infer<typeof listKitchenOrdersQuerySchema>;
