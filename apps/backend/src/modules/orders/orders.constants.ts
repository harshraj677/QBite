import type { OrderStatus } from './order.types';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export const ORDER_SORTABLE_FIELDS = ['createdAt', 'totalAmount'] as const;
export type OrderSortableField = (typeof ORDER_SORTABLE_FIELDS)[number];

/**
 * No documented tax policy exists anywhere in this project (checked
 * docs/QBite_SRS_PRD.md and docs/DATABASE_DESIGN.md — both mention a
 * `tax` field with no rate). Rather than invent a compliance-relevant
 * number, this is 0 until a real policy is supplied — the `tax` field
 * itself is fully wired up (computed, stored, returned), so turning
 * this on later is a one-line change, not a schema migration.
 */
export const ORDER_TAX_RATE_PERCENT = 0;

/**
 * The forward pipeline only — `cancelled` is deliberately unreachable
 * through this map. `PATCH /orders/:id/status` (OrdersService.updateStatus)
 * looks up the order's *current* status here to find the single legal
 * next status; anything else (including the same status again, or any
 * status not present in the target array) is rejected. Cancellation
 * has its own dedicated path (OrdersService.cancelOrder /
 * `PATCH /orders/:id/cancel`) specifically so there is exactly one
 * unambiguous way an order ever becomes `cancelled`, not two
 * overlapping ones.
 */
export const FORWARD_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['accepted'],
  accepted: ['preparing'],
  preparing: ['ready'],
  ready: ['completed'],
  completed: [],
  cancelled: [],
};

/** Statuses a caller may request via PATCH /orders/:id/status — excludes `pending` (the only entry state) and `cancelled` (use PATCH /orders/:id/cancel instead). */
export const UPDATABLE_ORDER_STATUSES = ['accepted', 'preparing', 'ready', 'completed'] as const;

/** Statuses from which an order may still be cancelled. Once completed or cancelled, an order is immutable. */
export const CANCELLABLE_ORDER_STATUSES: readonly OrderStatus[] = [
  'pending',
  'accepted',
  'preparing',
  'ready',
];
