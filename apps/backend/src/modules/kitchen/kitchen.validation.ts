import { z } from 'zod';

import { objectIdSchema } from '@validation/common.schemas';
import { ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES } from '@modules/orders/order.types';

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
//
// `dateFrom`/`dateTo`/`studentId`/`canteenId`/`paymentStatus`/
// `minAmount`/`maxAmount` were added for the Operations Center phase
// (the admin panel's `/orders` control-room page). Before this, the
// only unscoped (all-canteens) order list was `GET /kitchen/orders`,
// and it supported none of these — the *scoped* `GET
// /canteens/:canteenId/orders` had dateFrom/dateTo/studentId already,
// but "pick one canteen first" isn't how an operations dashboard
// needs to work. Rather than fake these as client-side filters over
// one loaded page (misleading — an admin filtering by payment status
// should see every matching order, not just the ones that happened to
// already be on screen), they're real, additive query params here,
// mirroring exactly how this same endpoint already gained
// `pickupToken` in the Kitchen Workflow phase. All optional — a
// request with none of them behaves identically to before.
//
// `paymentMethod` was added later still, for the Payments Management
// phase's Payments Table — same shape, same reasoning as
// `paymentStatus`.
export const listKitchenOrdersQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    status: z.enum(ORDER_STATUSES).optional(),
    paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
    /** Added for the Payments Management phase, same shape/reasoning as `paymentStatus` above. */
    paymentMethod: z.enum(PAYMENT_METHODS).optional(),
    orderNumber: z.string().trim().min(1).optional(),
    pickupToken: z
      .string()
      .trim()
      .regex(/^\d{6}$/, 'pickupToken must be a 6-digit code.')
      .optional(),
    studentId: objectIdSchema.optional(),
    canteenId: objectIdSchema.optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    /** Inclusive bounds on totalAmount, paise (see docs/DATABASE_DESIGN.md §6). */
    minAmount: z.coerce.number().int().nonnegative().optional(),
    maxAmount: z.coerce.number().int().nonnegative().optional(),
    /**
     * Added for the Kitchen Operations Center phase — see
     * OrdersService.searchOrders's doc comment on `includeItems`.
     * Defaults `false`, matching every pre-existing request's
     * behavior. Deliberately not `z.coerce.boolean()` — that coerces
     * *any* non-empty string truthy, including the literal query
     * string `"false"` (`Boolean("false") === true` in JS), which
     * would make `?includeItems=false` silently turn items on.
     */
    includeItems: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .refine(
    (data) => !data.dateFrom || !data.dateTo || data.dateFrom.getTime() <= data.dateTo.getTime(),
    {
      message: 'dateFrom must be before or equal to dateTo.',
      path: ['dateTo'],
    },
  )
  .refine(
    (data) =>
      data.minAmount === undefined ||
      data.maxAmount === undefined ||
      data.minAmount <= data.maxAmount,
    {
      message: 'minAmount must be less than or equal to maxAmount.',
      path: ['maxAmount'],
    },
  );
export type ListKitchenOrdersQuery = z.infer<typeof listKitchenOrdersQuerySchema>;
