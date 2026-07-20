import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getUsers } from '../api';
import type { UsersQueryParams } from '../types';

/**
 * A directory, not a live-monitoring surface — unlike Orders/Kitchen's
 * `refetchInterval` polling, this refetches on demand only
 * (filter/page/sort change, or a mutation's own invalidation). A user
 * account list doesn't need to visibly update every few seconds the
 * way an order queue does. `keepPreviousData` still applies, so a
 * filter/page change never blanks the table while the new page loads.
 */
export function useUsersQuery(params: UsersQueryParams) {
  return useQuery({
    queryKey: ['users', 'list', params],
    queryFn: () => getUsers(params),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
