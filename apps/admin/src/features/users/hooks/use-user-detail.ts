import { useQuery } from '@tanstack/react-query';
import { getUserDetail } from '../api';

/** Same query key shape (`['users', id]`) the Orders/Kitchen drawer's `useStudent` already uses for this exact endpoint — sharing the cache means opening a user from Orders and then from the Users directory doesn't refetch. */
export function useUserDetail(userId: string | null) {
  return useQuery({
    queryKey: ['users', userId],
    queryFn: () => getUserDetail(userId as string),
    enabled: userId !== null,
  });
}
