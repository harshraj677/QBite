import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { updateMenuItemAvailability } from '../api';
import type { MenuItemDto } from '../types';

interface MenuItemsListResult {
  data: MenuItemDto[];
  meta?: { total: number; page: number; limit: number; hasMore: boolean };
}

/** Optimistic availability toggle — same snapshot/patch/rollback shape as `useToggleCanteenStatus`/`useUpdateUserStatus`. The backend also clears `isFeatured` server-side when turning availability off (see menu-items.routes.ts's doc comment) — the optimistic patch mirrors that so a featured item's badge doesn't flash stale before the real response lands. */
export function useUpdateMenuItemAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, isAvailable }: { itemId: string; isAvailable: boolean }) =>
      updateMenuItemAvailability(itemId, isAvailable),

    onMutate: async ({ itemId, isAvailable }) => {
      await queryClient.cancelQueries({ queryKey: ['menu-items', 'list'] });
      await queryClient.cancelQueries({ queryKey: ['menu-items', 'detail', itemId] });

      const previousLists = queryClient.getQueriesData<MenuItemsListResult>({
        queryKey: ['menu-items', 'list'],
      });
      const previousDetail = queryClient.getQueryData<MenuItemDto>(['menu-items', 'detail', itemId]);

      function patch(item: MenuItemDto): MenuItemDto {
        return { ...item, isAvailable, isFeatured: isAvailable ? item.isFeatured : false };
      }

      queryClient.setQueriesData<MenuItemsListResult>({ queryKey: ['menu-items', 'list'] }, (old) => {
        if (!old) return old;
        return { ...old, data: old.data.map((item) => (item.id === itemId ? patch(item) : item)) };
      });
      if (previousDetail) {
        queryClient.setQueryData(['menu-items', 'detail', itemId], patch(previousDetail));
      }

      return { previousLists, previousDetail, itemId };
    },

    onError: (error, _variables, context) => {
      context?.previousLists.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      if (context?.previousDetail) {
        queryClient.setQueryData(['menu-items', 'detail', context.itemId], context.previousDetail);
      }
      toast.error("Couldn't update availability", {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    },

    onSuccess: (item) => {
      toast.success(`${item.name} is now ${item.isAvailable ? 'available' : 'unavailable'}`);
    },

    onSettled: (_data, _error, { itemId }) => {
      void queryClient.invalidateQueries({ queryKey: ['menu-items', 'list'] });
      void queryClient.invalidateQueries({ queryKey: ['menu-items', 'detail', itemId] });
    },
  });
}
