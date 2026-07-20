import type { OrderStatus, PaymentStatus } from '@/types/order';

/**
 * Single source of truth for how an order/payment status renders,
 * anywhere in the app — the Dashboard's Orders-by-Status donut and
 * Kitchen Status widget, and the Operations Center's table chips,
 * filters, and drawer all import from here instead of each
 * re-declaring their own label/color map. Moved here (from
 * `features/dashboard/`) during the Operations Center phase once a
 * second feature needed the exact same maps — same relationship
 * `modules/audit` on the backend has to `modules/auth` (extracted once
 * a second consumer appeared, not duplicated).
 */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const ORDER_STATUS_BADGE_VARIANT: Record<
  OrderStatus,
  'secondary' | 'warning' | 'success' | 'destructive'
> = {
  pending: 'secondary',
  accepted: 'warning',
  preparing: 'warning',
  ready: 'warning',
  completed: 'success',
  cancelled: 'destructive',
};

/** Distinct per-slice colors for the Orders-by-Status donut — `completed`/`cancelled` reuse the same semantic success/destructive tokens the badges above use (so the chart and the badges agree at a glance); the four "in progress" statuses each get their own brand-palette color since a donut needs more differentiation than a 2-tone badge scheme does. */
export const ORDER_STATUS_CHART_COLOR: Record<OrderStatus, string> = {
  pending: 'var(--chart-1)',
  accepted: 'var(--chart-2)',
  preparing: 'var(--chart-3)',
  ready: 'var(--chart-4)',
  completed: 'var(--success)',
  cancelled: 'var(--destructive)',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Payment pending',
  paid: 'Paid',
  failed: 'Payment failed',
  refunded: 'Refunded',
};

export const PAYMENT_STATUS_BADGE_VARIANT: Record<
  PaymentStatus,
  'secondary' | 'warning' | 'success' | 'destructive'
> = {
  pending: 'secondary',
  paid: 'success',
  failed: 'destructive',
  refunded: 'warning',
};

export const ORDER_STATUS_ORDER: OrderStatus[] = [
  'pending',
  'accepted',
  'preparing',
  'ready',
  'completed',
  'cancelled',
];

/** Forward-only transition map — mirrors apps/backend/src/modules/orders/orders.constants.ts's FORWARD_TRANSITIONS. Drives which status-advance action(s), if any, the Operations Center offers for a given order. */
export const ORDER_FORWARD_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['accepted'],
  accepted: ['preparing'],
  preparing: ['ready'],
  ready: ['completed'],
  completed: [],
  cancelled: [],
};
