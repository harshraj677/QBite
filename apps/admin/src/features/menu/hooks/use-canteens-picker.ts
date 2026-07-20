import { useQuery } from '@tanstack/react-query';
import { getCanteens } from '@/features/canteens/api';

/** Powers the Directory's canteen picker — reuses the Canteens feature's own `getCanteens` directly rather than redeclaring a fetch (no duplicated business logic). A flat, unfiltered, name-sorted list is all a picker needs. */
export function useCanteensPicker() {
  return useQuery({
    queryKey: ['canteens', 'picker'],
    queryFn: () => getCanteens({ page: 1, limit: 50, sortBy: 'name', sortOrder: 'asc' }),
    staleTime: 60_000,
  });
}
