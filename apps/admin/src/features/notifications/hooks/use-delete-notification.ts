import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { deleteNotification } from '../api';
import type { NotificationDto } from '../types';

interface NotificationsListResult {
  data: NotificationDto[];
  meta?: { total: number; page: number; limit: number; hasMore: boolean };
}

/** Optimistic removal — same snapshot/patch/rollback shape as this session's other mutations, patch here being a filter instead of a field update. */
export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => deleteNotification(notificationId),

    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: ['notifications', 'list'] });

      const previousLists = queryClient.getQueriesData<NotificationsListResult>({
        queryKey: ['notifications', 'list'],
      });

      queryClient.setQueriesData<NotificationsListResult>(
        { queryKey: ['notifications', 'list'] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.filter((n) => n.id !== notificationId),
            meta: old.meta ? { ...old.meta, total: Math.max(0, old.meta.total - 1) } : old.meta,
          };
        },
      );

      return { previousLists };
    },

    onError: (error, _notificationId, context) => {
      context?.previousLists.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      toast.error("Couldn't delete notification", {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    },

    onSuccess: () => {
      toast.success('Notification deleted');
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });
}
