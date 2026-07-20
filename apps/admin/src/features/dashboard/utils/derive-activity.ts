import type { OrderDto, OrderStatus } from '../types';

/** `'pending'` is deliberately excluded — it's the initial resting status, not something that gets a distinct timestamp; the moment an order exists at all, it's represented as a `'placed'` event instead (see STATUS_EVENT_FIELDS below, which has no entry mapping to `'pending'`). */
export type ActivityEventType = Exclude<OrderStatus, 'pending'> | 'placed';

export interface ActivityEvent {
  id: string;
  orderId: string;
  orderNumber: string;
  type: ActivityEventType;
  timestamp: string;
  paymentStatus: OrderDto['paymentStatus'];
  totalAmount: number;
  cancellationReason?: string;
}

const STATUS_EVENT_FIELDS: Array<{ field: keyof OrderDto; type: ActivityEventType }> = [
  { field: 'createdAt', type: 'placed' },
  { field: 'acceptedAt', type: 'accepted' },
  { field: 'preparingAt', type: 'preparing' },
  { field: 'readyAt', type: 'ready' },
  { field: 'completedAt', type: 'completed' },
  { field: 'cancelledAt', type: 'cancelled' },
];

/**
 * Turns a page of real orders into a flat, chronological event feed —
 * the backend has no dedicated activity-log/event-stream endpoint
 * (audit logs have no HTTP surface at all — internal-only, see
 * ARCHITECTURE.md §3.1's `modules/audit` note), so "Live Activity" is
 * built from timestamps every order already carries rather than
 * fabricated. Pure function — safe to wrap in `useMemo` keyed on the
 * `orders` array reference.
 */
export function deriveActivityEvents(orders: OrderDto[], limit = 15): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  for (const order of orders) {
    for (const { field, type } of STATUS_EVENT_FIELDS) {
      const value = order[field];
      if (typeof value === 'string' && value.length > 0) {
        events.push({
          id: `${order.id}-${type}`,
          orderId: order.id,
          orderNumber: order.orderNumber,
          type,
          timestamp: value,
          paymentStatus: order.paymentStatus,
          totalAmount: order.totalAmount,
          cancellationReason: order.cancellationReason,
        });
      }
    }
  }
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return events.slice(0, limit);
}
