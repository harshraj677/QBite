import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { advanceOrderStatus } from '../api';
import type { OrderDto, OrderStatus, OrderWithItemsDto } from '../types';
import { ORDER_STATUS_LABELS } from '@/lib/order-status';

const TIMESTAMP_FIELD: Partial<Record<OrderStatus, keyof OrderDto>> = {
  accepted: 'acceptedAt',
  preparing: 'preparingAt',
  ready: 'readyAt',
  completed: 'completedAt',
};

function patchOrder<T extends OrderDto>(order: T, toStatus: OrderStatus): T {
  const timestampField = TIMESTAMP_FIELD[toStatus];
  return {
    ...order,
    status: toStatus,
    ...(timestampField ? { [timestampField]: new Date().toISOString() } : {}),
  };
}

interface OrdersListResult {
  data: OrderDto[];
  meta?: { total: number; page: number; limit: number; hasMore: boolean };
}

/**
 * Optimistic status advance — the row updates the instant an admin
 * clicks an action, not after the round trip. `onMutate` patches every
 * currently-cached orders-list page (there can be more than one — the
 * admin may have switched filters and back) plus the detail cache, so
 * whichever view is on screen reflects the change immediately with no
 * flash of stale data; `onError` restores the exact snapshots taken
 * beforehand; `onSettled` reconciles with the server's real state
 * regardless of outcome, since this mutation's own optimistic patch is
 * deliberately partial (it only sets `status` + one timestamp — it
 * doesn't know about audit logs, notifications, etc. the real update
 * also triggers server-side).
 */
export function useAdvanceOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, toStatus }: { orderId: string; toStatus: OrderStatus }) =>
      advanceOrderStatus(orderId, toStatus),

    onMutate: async ({ orderId, toStatus }) => {
      await queryClient.cancelQueries({ queryKey: ['orders', 'list'] });
      await queryClient.cancelQueries({ queryKey: ['orders', 'detail', orderId] });

      const previousLists = queryClient.getQueriesData<OrdersListResult>({
        queryKey: ['orders', 'list'],
      });
      const previousDetail = queryClient.getQueryData<OrderWithItemsDto>([
        'orders',
        'detail',
        orderId,
      ]);

      queryClient.setQueriesData<OrdersListResult>({ queryKey: ['orders', 'list'] }, (old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((order) =>
            order.id === orderId ? patchOrder(order, toStatus) : order,
          ),
        };
      });

      if (previousDetail) {
        queryClient.setQueryData(
          ['orders', 'detail', orderId],
          patchOrder(previousDetail, toStatus),
        );
      }

      return { previousLists, previousDetail, orderId };
    },

    onError: (error, _variables, context) => {
      context?.previousLists.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      if (context?.previousDetail) {
        queryClient.setQueryData(['orders', 'detail', context.orderId], context.previousDetail);
      }
      toast.error('Could not update the order', {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    },

    onSuccess: (_data, { toStatus }) => {
      toast.success(`Order marked as ${ORDER_STATUS_LABELS[toStatus].toLowerCase()}`);
    },

    onSettled: (_data, _error, { orderId }) => {
      void queryClient.invalidateQueries({ queryKey: ['orders', 'list'] });
      void queryClient.invalidateQueries({ queryKey: ['orders', 'detail', orderId] });
    },
  });
}
