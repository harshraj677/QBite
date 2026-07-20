import { useQuery } from '@tanstack/react-query';
import { getOrders } from '@/features/orders/api';

const MAX_ORDERS = 50; // GET /kitchen/orders' own hard page-size cap

/**
 * Powers the drawer's Order Summary and Payment Summary sections —
 * both fully derived from the *same* real `GET /kitchen/orders?studentId=`
 * call the Operations Center already makes (see features/orders/api.ts),
 * not a new backend endpoint. `meta.total` is an exact, real,
 * unbounded count (the backend's `countDocuments`, not limited by page
 * size) — Order Summary's "N total orders" is always exact. Payment
 * Summary (paid/pending/failed/refunded counts + amount paid) is
 * computed over the up-to-50 most recent orders this fetches, which is
 * exact for the common case (a student with <=50 orders) and honestly
 * labeled as "most recent 50" by the caller when `meta.total` exceeds
 * that, rather than silently presenting a partial sum as a lifetime
 * total. Deliberately not a new backend aggregate endpoint — see this
 * phase's report for why reusing the existing endpoint was preferred
 * here over another minimal-extension.
 */
export function useUserOrders(studentId: string | null) {
  return useQuery({
    queryKey: ['users', studentId, 'orders'],
    queryFn: () =>
      getOrders({
        studentId: studentId as string,
        page: 1,
        limit: MAX_ORDERS,
        sortOrder: 'desc',
      }),
    enabled: studentId !== null,
  });
}
