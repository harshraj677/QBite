import { useQuery } from '@tanstack/react-query';
import { getDashboardOverview } from '../api';

/** GET /analytics/dashboard is admin/super_admin only on the backend — this hook is only ever mounted from a page already gated to those roles (see app/(dashboard)/dashboard/page.tsx). */
export function useDashboardOverview() {
  return useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: getDashboardOverview,
    refetchInterval: 60_000,
  });
}
