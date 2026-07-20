import { useQueries } from '@tanstack/react-query';
import { getOrders } from '@/features/orders/api';
import type { PaymentStatus } from '../types';

const STATUSES: PaymentStatus[] = ['paid', 'failed', 'pending', 'refunded'];

/**
 * "Payment Analytics... do not create new aggregation endpoints" — this
 * gets exact, real, all-time counts per payment status via four real
 * `GET /kitchen/orders?paymentStatus=X&limit=1` requests, reading each
 * one's genuine `meta.total` (an unbounded `countDocuments`, not a
 * page-size-limited estimate). Four small requests, not a new backend
 * aggregate — the same idiom the Canteens Management phase used for
 * its own exact per-status/per-canteen stat cards.
 */
export function usePaymentStatusCounts() {
  const results = useQueries({
    queries: STATUSES.map((paymentStatus) => ({
      queryKey: ['payments', 'status-count', paymentStatus],
      queryFn: () => getOrders({ paymentStatus, page: 1, limit: 1, sortOrder: 'desc' as const }),
      staleTime: 20_000,
    })),
  });

  const isPending = results.some((r) => r.isPending);
  const isError = results.some((r) => r.isError);
  const counts = Object.fromEntries(
    STATUSES.map((status, i) => [status, results[i].data?.meta?.total ?? 0]),
  ) as Record<PaymentStatus, number>;

  const totalCounted = counts.paid + counts.failed + counts.pending + counts.refunded;
  const successRate = totalCounted > 0 ? Math.round((counts.paid / totalCounted) * 1000) / 10 : 0;

  return { counts, successRate, isPending, isError };
}
