import { useQuery } from '@tanstack/react-query';
import { getCanteenDetail } from '../api';

export function useCanteenDetail(canteenId: string | null) {
  return useQuery({
    queryKey: ['canteens', 'detail', canteenId],
    queryFn: () => getCanteenDetail(canteenId as string),
    enabled: canteenId !== null,
  });
}
