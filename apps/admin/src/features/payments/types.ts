/**
 * There is no `GET /payments` list endpoint on this backend — only
 * per-order/per-payment single lookups (`GET /payments/order/:orderId`,
 * `GET /payments/:id`). The Payments Table is therefore built on the
 * real, existing, unscoped `GET /kitchen/orders` (the same endpoint
 * the Operations Center already uses) — every order already carries
 * its own real `paymentStatus`/`paymentMethod`/`totalAmount`. See
 * ARCHITECTURE.md's Payments Management note for the full reasoning.
 * Every type below is reused directly from Orders, not redeclared.
 */
export type {
  OrderDto,
  OrdersFilters as PaymentsFilters,
  OrdersQueryParams as PaymentsQueryParams,
  PaymentDto,
  PaymentMethod,
  PaymentStatus,
} from '@/features/orders/types';
