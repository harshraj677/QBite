import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getOrders, getStudent } from '../api';

/**
 * There is no "search/list students" endpoint on the backend — only
 * `GET /users/:id`, a lookup by exact id (see users.routes.ts's doc
 * comment: it was added specifically for the drawer's Student
 * section, not as a directory). Building a real name-search Student
 * filter therefore means working from students who actually appear in
 * recent orders, not a full user directory: this pulls the 50 most
 * recent orders (unfiltered), extracts the unique `studentId`s, and
 * resolves each to a real name/email via `GET /users/:id` (batched
 * with `useQueries`, one request per unique student — capped at 50 by
 * construction). The Student filter combobox searches within this
 * real, if incomplete, set — never a fabricated one. Its label makes
 * the scope explicit ("recent students") rather than implying a full
 * directory.
 */
export function useKnownStudents() {
  const recentOrders = useQuery({
    queryKey: ['orders', 'list', 'recent-for-student-filter'],
    queryFn: () => getOrders({ page: 1, limit: 50, sortOrder: 'desc' }),
    staleTime: 60_000,
  });

  const studentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const order of recentOrders.data?.data ?? []) ids.add(order.studentId);
    return Array.from(ids);
  }, [recentOrders.data]);

  const studentQueries = useQueries({
    queries: studentIds.map((id) => ({
      queryKey: ['users', id],
      queryFn: () => getStudent(id),
      staleTime: 5 * 60_000,
    })),
  });

  const students = useMemo(
    () =>
      studentQueries
        .map((q) => q.data)
        .filter((student) => student !== undefined)
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [studentQueries],
  );

  return {
    students,
    isPending: recentOrders.isPending || studentQueries.some((q) => q.isPending),
  };
}
