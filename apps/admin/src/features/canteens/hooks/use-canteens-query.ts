import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getCanteens } from '../api';
import type { CanteensQueryParams } from '../types';

/** A directory, not a live surface — refetches on filter/page/mutation, not on an interval (same reasoning as `useUsersQuery`). */
export function useCanteensQuery(params: CanteensQueryParams) {
  return useQuery({
    queryKey: ['canteens', 'list', params],
    queryFn: () => getCanteens(params),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
