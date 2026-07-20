import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { markNotificationAsRead } from '../api';
import type { NotificationDto } from '../types';

interface NotificationsListResult {
  data: NotificationDto[];
  meta?: { total: number; page: number; limit: number; hasMore: boolean };
}

/** Optimistic mark-as-read — same snapshot/patch/rollback shape as this session's other status mutations. Also invalidates the sidebar bell's unread count (`['notifications', 'unread-count']`), since marking one notification read changes that real, separately-cached number too. */
export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => markNotificationAsRead(notificationId),

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
            data: old.data.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)),
          };
        },
      );

      return { previousLists };
    },

    onError: (error, _notificationId, context) => {
      context?.previousLists.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      toast.error("Couldn't mark as read", {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });
}
