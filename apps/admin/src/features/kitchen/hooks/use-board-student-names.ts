import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getStudent } from '@/features/orders/api';

/**
 * Resolves a real name for every student currently on the board via
 * the same `GET /users/:id` the Operations Center's drawer uses —
 * legitimate here (unlike a general student *directory* search) because
 * the board is bounded by construction (an active kitchen queue, not
 * paginated history — `useKitchenOrders` caps at 50), so "every
 * student with an order currently on screen" is a small, real set,
 * not an attempt to fake a full roster. Takes any array of objects
 * with a real `studentId` — widened from `OrderWithItemsDto[]` so the
 * Payments Management phase can reuse this exact hook for its own
 * (also bounded) table instead of redeclaring the same batched-lookup
 * logic.
 */
export function useBoardStudentNames(orders: Array<{ studentId: string }>) {
  const studentIds = useMemo(() => Array.from(new Set(orders.map((o) => o.studentId))), [orders]);

  const results = useQueries({
    queries: studentIds.map((id) => ({
      queryKey: ['users', id],
      queryFn: () => getStudent(id),
      staleTime: 5 * 60_000,
    })),
  });

  return useMemo(() => {
    const map = new Map<string, string>();
    studentIds.forEach((id, index) => {
      const name = results[index]?.data?.fullName;
      if (name) map.set(id, name);
    });
    return map;
  }, [studentIds, results]);
}
