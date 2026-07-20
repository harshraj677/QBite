import { getOrders } from '@/features/orders/api';
import type { OrdersFilters } from './types';

/**
 * Reuses `features/orders/api.ts`'s `getOrders` — the exact same
 * `GET /kitchen/orders` call the Operations Center makes, just always
 * with `includeItems: true` (a KDS card shows items without drilling
 * in) and a tighter page size (an active kitchen queue is small; 50 —
 * the backend's own max — comfortably covers a real rush).
 */
export function getKitchenOrders(filters: OrdersFilters) {
  return getOrders({
    ...filters,
    includeItems: true,
    page: 1,
    limit: 50,
    sortOrder: 'asc', // oldest first — the ticket that's waited longest surfaces first, the standard KDS ordering
  });
}
