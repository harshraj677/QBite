import { z } from 'zod';

import { objectIdSchema } from '@validation/common.schemas';
import { ORDER_STATUSES, PAYMENT_METHODS } from './order.types';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, UPDATABLE_ORDER_STATUSES } from './orders.constants';

/**
 * Field-level *format* validation lives here (Zod, at the request
 * boundary) — cross-field *business* rules (item availability,
 * canteen match, pricing computation, status-transition legality)
 * live in OrdersService. Same split as every other module.
 */

const orderItemInputSchema = z.object({
  menuItemId: objectIdSchema,
  quantity: z.coerce.number().int().positive('quantity must be a positive integer.'),
  notes: z.string().trim().max(300).optional(),
});

// `totalAmount`/`subtotal`/`tax`/`discount` are deliberately absent
// from this schema — not rejected, just never parsed through, so the
// server's computed values are the only ones that can ever reach
// OrdersService. See orders.service.ts's placeOrder.
export const createOrderSchema = z.object({
  items: z.array(orderItemInputSchema).min(1, 'At least one item is required.'),
  paymentMethod: z.enum(PAYMENT_METHODS),
  notes: z.string().trim().max(500).optional(),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const updateOrderStatusSchema = z.object({
  status: z.enum(UPDATABLE_ORDER_STATUSES),
});
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

export const cancelOrderSchema = z.object({
  cancellationReason: z.string().trim().min(2).max(300).optional(),
});
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;

export const orderIdParamSchema = z.object({
  id: objectIdSchema,
});
export type OrderIdParam = z.infer<typeof orderIdParamSchema>;

export const canteenIdParamSchema = z.object({
  canteenId: objectIdSchema,
});
export type CanteenIdParam = z.infer<typeof canteenIdParamSchema>;

// Orders default to most-recent-first — unlike menu categories/items
// (which default to displayOrder asc), there's no manual ordering
// concept for orders, and "what did I just order" is the overwhelmingly
// common query.
const baseListOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  orderNumber: z.string().trim().min(1).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  sortBy: z.enum(['createdAt', 'totalAmount']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const listMyOrdersQuerySchema = baseListOrdersQuerySchema;
export type ListMyOrdersQuery = z.infer<typeof listMyOrdersQuerySchema>;

export const listCanteenOrdersQuerySchema = baseListOrdersQuerySchema.extend({
  studentId: objectIdSchema.optional(),
});
export type ListCanteenOrdersQuery = z.infer<typeof listCanteenOrdersQuerySchema>;
