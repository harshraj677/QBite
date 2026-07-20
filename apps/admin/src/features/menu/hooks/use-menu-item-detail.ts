import { useQuery } from '@tanstack/react-query';
import { getMenuItemDetail } from '../api';

export function useMenuItemDetail(itemId: string | null) {
  return useQuery({
    queryKey: ['menu-items', 'detail', itemId],
    queryFn: () => getMenuItemDetail(itemId as string),
    enabled: itemId !== null,
  });
}
