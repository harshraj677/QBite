import { apiFetch, apiFetchData, type QueryValue } from '@/lib/api/client';
import type {
  OrderDto,
  OrdersQueryParams,
  OrderStatus,
  OrderWithItemsDto,
  PaymentDto,
  StudentDto,
} from './types';

/**
 * `GET /kitchen/orders` — the Operations Center's one real, unscoped,
 * server-paginated data source (see ARCHITECTURE.md's "Operations
 * Center" note on why every filter here is a real query param, not a
 * client-side post-filter). Returns `{data, meta}` — the table needs
 * `meta.total` for real pagination, so this uses `apiFetch`, not
 * `apiFetchData`. No line items on the list rows (the list endpoint
 * deliberately omits them — see `getOrderDetail` below for those).
 */
export function getOrders(params: OrdersQueryParams) {
  return apiFetch<OrderDto[]>('/kitchen/orders', {
    query: params as unknown as Record<string, QueryValue>,
  });
}

export function getOrderDetail(id: string): Promise<OrderWithItemsDto> {
  return apiFetchData<OrderWithItemsDto>(`/orders/${id}`);
}

/** `GET /payments/order/:orderId` — the SUCCESS payment if one exists, otherwise the most recent attempt. 404 when the order has no payment attempts yet (e.g. a still-`pending` cash order) — callers treat that as "no payment," not an error. */
export function getOrderPayment(orderId: string): Promise<PaymentDto> {
  return apiFetchData<PaymentDto>(`/payments/order/${orderId}`);
}

/** `GET /users/:id` — added in this phase specifically for the drawer's Student section (see users.routes.ts's doc comment). */
export function getStudent(studentId: string): Promise<StudentDto> {
  return apiFetchData<StudentDto>(`/users/${studentId}`);
}

const STATUS_ENDPOINT: Record<string, string> = {
  accepted: 'accept',
  preparing: 'start-preparing',
  ready: 'ready',
  completed: 'complete',
};

/** The kitchen's 4 fixed-target transitions — same endpoints the (not-yet-built) Kitchen page will use. No request body; the target status is implied by which endpoint is called. */
export function advanceOrderStatus(orderId: string, toStatus: OrderStatus): Promise<OrderDto> {
  const segment = STATUS_ENDPOINT[toStatus];
  if (!segment) {
    throw new Error(`"${toStatus}" is not a valid forward-transition target.`);
  }
  return apiFetchData<OrderDto>(`/kitchen/orders/${orderId}/${segment}`, { method: 'PATCH' });
}
