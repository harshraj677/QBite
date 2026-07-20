import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getMenuItems } from '../api';
import type { MenuItemsQueryParams } from '../types';

/** A directory, not a live surface — refetches on filter/canteen/page/mutation, not on an interval (same reasoning as `useUsersQuery`/`useCanteensQuery`). */
export function useMenuItemsQuery(canteenId: string | undefined, params: MenuItemsQueryParams) {
  return useQuery({
    queryKey: ['menu-items', 'list', canteenId, params],
    queryFn: () => getMenuItems(canteenId as string, params),
    enabled: canteenId !== undefined,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
