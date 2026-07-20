import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCategories } from '../api';

/** Powers both the category filter dropdown and the drawer's category-name lookup (items only carry `categoryId` — same "resolve a name from a small, real, already-fetched list" pattern as `useCanteenNameMap`). */
export function useCategoriesQuery(canteenId: string | undefined) {
  const query = useQuery({
    queryKey: ['menu-categories', canteenId],
    queryFn: () => getCategories(canteenId as string),
    enabled: canteenId !== undefined,
    staleTime: 60_000,
  });

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of query.data?.data ?? []) {
      map.set(category.id, category.name);
    }
    return map;
  }, [query.data]);

  return { ...query, categories: query.data?.data ?? [], nameById };
}
