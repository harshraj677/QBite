import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/errors';
import { getOrderDetail, getOrderPayment, getStudent } from '../api';

export function useOrderDetail(orderId: string | null) {
  return useQuery({
    queryKey: ['orders', 'detail', orderId],
    queryFn: () => getOrderDetail(orderId as string),
    enabled: orderId !== null,
  });
}

/**
 * A 404 here is a legitimate, common state (a still-`pending` cash
 * order has no payment attempt yet) — not an error to retry. `retry:
 * false` plus treating a 404 `ApiError` as "no payment" (via
 * `isNotFound` below) is what lets the drawer's Payment section
 * render a real empty state instead of the generic error/retry card.
 */
export function useOrderPayment(orderId: string | null) {
  const query = useQuery({
    queryKey: ['orders', 'payment', orderId],
    queryFn: () => getOrderPayment(orderId as string),
    enabled: orderId !== null,
    retry: false,
  });
  const isNotFound = query.error instanceof ApiError && query.error.status === 404;
  return { ...query, isNotFound };
}

export function useStudent(studentId: string | null) {
  return useQuery({
    queryKey: ['users', studentId],
    queryFn: () => getStudent(studentId as string),
    enabled: studentId !== null,
    staleTime: 5 * 60_000,
  });
}
