import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { toggleCanteenStatus } from '../api';
import type { CanteenDto } from '../types';

interface CanteensListResult {
  data: CanteenDto[];
  meta?: { total: number; page: number; limit: number; hasMore: boolean };
}

/** Optimistic toggle — same snapshot/patch/rollback shape as `useUpdateUserStatus`/`useAdvanceOrderStatus`. The backend endpoint takes no body (it's a pure flip), so the optimistic patch flips the locally-known current value rather than setting an explicit target. */
export function useToggleCanteenStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (canteenId: string) => toggleCanteenStatus(canteenId),

    onMutate: async (canteenId) => {
      await queryClient.cancelQueries({ queryKey: ['canteens', 'list'] });
      await queryClient.cancelQueries({ queryKey: ['canteens', 'detail', canteenId] });

      const previousLists = queryClient.getQueriesData<CanteensListResult>({
        queryKey: ['canteens', 'list'],
      });
      const previousDetail = queryClient.getQueryData<CanteenDto>(['canteens', 'detail', canteenId]);

      queryClient.setQueriesData<CanteensListResult>({ queryKey: ['canteens', 'list'] }, (old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((c) => (c.id === canteenId ? { ...c, isOpen: !c.isOpen } : c)),
        };
      });
      if (previousDetail) {
        queryClient.setQueryData(['canteens', 'detail', canteenId], {
          ...previousDetail,
          isOpen: !previousDetail.isOpen,
        });
      }

      return { previousLists, previousDetail, canteenId };
    },

    onError: (error, _canteenId, context) => {
      context?.previousLists.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      if (context?.previousDetail) {
        queryClient.setQueryData(['canteens', 'detail', context.canteenId], context.previousDetail);
      }
      toast.error("Couldn't update the canteen's status", {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    },

    onSuccess: (canteen) => {
      toast.success(`${canteen.name} is now ${canteen.isOpen ? 'Open' : 'Closed'}`);
    },

    onSettled: (_data, _error, canteenId) => {
      void queryClient.invalidateQueries({ queryKey: ['canteens', 'list'] });
      void queryClient.invalidateQueries({ queryKey: ['canteens', 'detail', canteenId] });
    },
  });
}
