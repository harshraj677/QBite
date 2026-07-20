import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { markAllNotificationsAsRead } from '../api';
import type { NotificationDto } from '../types';

interface NotificationsListResult {
  data: NotificationDto[];
  meta?: { total: number; page: number; limit: number; hasMore: boolean };
}

/** Optimistically flips every currently-cached notification to read — the real mutation (`PATCH /notifications/read-all`) affects every unread notification for the caller server-side, not just what's loaded client-side, so `onSettled` still refetches for full correctness. */
export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => markAllNotificationsAsRead(),

    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications', 'list'] });

      const previousLists = queryClient.getQueriesData<NotificationsListResult>({
        queryKey: ['notifications', 'list'],
      });

      queryClient.setQueriesData<NotificationsListResult>(
        { queryKey: ['notifications', 'list'] },
        (old) => {
          if (!old) return old;
          return { ...old, data: old.data.map((n) => ({ ...n, isRead: true })) };
        },
      );

      return { previousLists };
    },

    onError: (error, _variables, context) => {
      context?.previousLists.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      toast.error("Couldn't mark all as read", {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    },

    onSuccess: ({ updatedCount }) => {
      toast.success(
        updatedCount > 0 ? `${updatedCount} notification${updatedCount === 1 ? '' : 's'} marked as read` : 'Nothing to mark — everything was already read',
      );
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });
}
