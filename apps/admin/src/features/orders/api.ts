import { apiFetch, apiFetchData, type ApiResult, type QueryValue } from '@/lib/api/client';
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
 * `apiFetchData`. No line items on the list rows by default — only
 * when `includeItems: true` is passed (the Kitchen Operations Center's
 * `getKitchenOrders`, see features/kitchen/api.ts), which the two
 * overloads below reflect at the type level, mirroring the real,
 * conditional response shape `orders.service.ts` produces.
 */
export function getOrders(
  params: OrdersQueryParams & { includeItems: true },
): Promise<ApiResult<OrderWithItemsDto[]>>;
export function getOrders(params: OrdersQueryParams): Promise<ApiResult<OrderDto[]>>;
export function getOrders(params: OrdersQueryParams) {
  return apiFetch<(OrderDto | OrderWithItemsDto)[]>('/kitchen/orders', {
    query: params as unknown as Record<string, QueryValue>,
  });
}

/**
 * Every single-resource `sendSuccess(res, { order })`-style endpoint
 * in this backend wraps its payload in a named key — never the bare
 * resource — unlike `sendPaginated`'s bare-array `data` (see
 * `getOrders` above) or an analytics endpoint's bare aggregate. Each
 * function below unwraps its own key explicitly instead of typing the
 * wrapper away with `apiFetchData<Resource>(...)`, which was a real
 * bug (found once Atlas connectivity came back and made a live
 * envelope-shape check possible for the first time this project):
 * every field read off the "resource" was actually reading it off the
 * `{ order: {...} }` wrapper object, so `order.orderNumber` etc. were
 * silently `undefined` everywhere this was consumed (the Operations
 * Center drawer, the Kitchen board's per-card student name, the
 * Dashboard's order quick-look sheet). Confirmed against the
 * already-passing backend integration tests' own response-shape
 * assertions (`res.body.data.order`/`.payment`/`.user`), not guessed.
 */
export async function getOrderDetail(id: string): Promise<OrderWithItemsDto> {
  const { order } = await apiFetchData<{ order: OrderWithItemsDto }>(`/orders/${id}`);
  return order;
}

/** `GET /payments/order/:orderId` — the SUCCESS payment if one exists, otherwise the most recent attempt. 404 when the order has no payment attempts yet (e.g. a still-`pending` cash order) — callers treat that as "no payment," not an error. */
export async function getOrderPayment(orderId: string): Promise<PaymentDto> {
  const { payment } = await apiFetchData<{ payment: PaymentDto }>(`/payments/order/${orderId}`);
  return payment;
}

/** `GET /users/:id` — added in this phase specifically for the drawer's Student section (see users.routes.ts's doc comment). */
export async function getStudent(studentId: string): Promise<StudentDto> {
  const { user } = await apiFetchData<{ user: StudentDto }>(`/users/${studentId}`);
  return user;
}

const STATUS_ENDPOINT: Record<string, string> = {
  accepted: 'accept',
  preparing: 'start-preparing',
  ready: 'ready',
  completed: 'complete',
};

/** The kitchen's 4 fixed-target transitions — same endpoints the Kitchen page uses. No request body; the target status is implied by which endpoint is called. */
export async function advanceOrderStatus(orderId: string, toStatus: OrderStatus): Promise<OrderDto> {
  const segment = STATUS_ENDPOINT[toStatus];
  if (!segment) {
    throw new Error(`"${toStatus}" is not a valid forward-transition target.`);
  }
  const { order } = await apiFetchData<{ order: OrderDto }>(
    `/kitchen/orders/${orderId}/${segment}`,
    { method: 'PATCH' },
  );
  return order;
}
