import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { updateUserRole } from '../api';
import type { UserDto, UserRole } from '../types';

interface UsersListResult {
  data: UserDto[];
  meta?: { total: number; page: number; limit: number; hasMore: boolean };
}

/**
 * Optimistic role change — same snapshot/patch/rollback shape as
 * `useAdvanceOrderStatus` (see that hook's doc comment): every cached
 * users-list page plus the detail cache is patched immediately in
 * `onMutate`, restored verbatim in `onError`, and reconciled with the
 * server's real state in `onSettled` regardless of outcome.
 */
export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      updateUserRole(userId, role),

    onMutate: async ({ userId, role }) => {
      await queryClient.cancelQueries({ queryKey: ['users', 'list'] });
      await queryClient.cancelQueries({ queryKey: ['users', userId] });

      const previousLists = queryClient.getQueriesData<UsersListResult>({
        queryKey: ['users', 'list'],
      });
      const previousDetail = queryClient.getQueryData<UserDto>(['users', userId]);

      queryClient.setQueriesData<UsersListResult>({ queryKey: ['users', 'list'] }, (old) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((user) => (user.id === userId ? { ...user, role } : user)),
        };
      });
      if (previousDetail) {
        queryClient.setQueryData(['users', userId], { ...previousDetail, role });
      }

      return { previousLists, previousDetail, userId };
    },

    onError: (error, _variables, context) => {
      context?.previousLists.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      if (context?.previousDetail) {
        queryClient.setQueryData(['users', context.userId], context.previousDetail);
      }
      toast.error("Couldn't change the role", {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    },

    onSuccess: (user) => {
      toast.success(`${user.fullName}'s role is now ${user.role.replace('_', ' ')}`);
    },

    onSettled: (_data, _error, { userId }) => {
      void queryClient.invalidateQueries({ queryKey: ['users', 'list'] });
      void queryClient.invalidateQueries({ queryKey: ['users', userId] });
    },
  });
}
