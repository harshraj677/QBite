export type {
  OrderDto,
  OrderItemDto,
  OrderItemSnapshot,
  OrderStatus,
  OrderWithItemsDto,
  OrdersFilters,
  PaymentMethod,
  PaymentStatus,
} from '@/features/orders/types';

/**
 * There is no `priority` field anywhere in the backend's Order model
 * — this is a client-side-derived signal, not a stored one. It's
 * exactly the same information as the timer's urgency color
 * (`getUrgencyLevel`), presented as a compact label instead of a
 * color, so "Priority" (the spec's term) and "Timer color" (the
 * spec's other term) are one real, honest signal, not two — the
 * alternative (inventing a separate stored priority field with no
 * backend concept behind it) would be exactly the kind of fabricated
 * data this phase's "no mock data" rule rules out.
 */
export type Priority = 'normal' | 'attention' | 'urgent' | 'critical';

export const KITCHEN_BOARD_STATUSES = ['pending', 'accepted', 'preparing', 'ready', 'completed'] as const;
