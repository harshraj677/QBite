import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { updateUserStatus } from '../api';
import type { UserDto } from '../types';

interface UsersListResult {
  data: UserDto[];
  meta?: { total: number; page: number; limit: number; hasMore: boolean };
}

/** Same optimistic snapshot/patch/rollback shape as `useUpdateUserRole` — see that hook's doc comment. */
export function useUpdateUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      updateUserStatus(userId, isActive),

    onMutate: async ({ userId, isActive }) => {
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
          data: old.data.map((user) => (user.id === userId ? { ...user, isActive } : user)),
        };
      });
      if (previousDetail) {
        queryClient.setQueryData(['users', userId], { ...previousDetail, isActive });
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
      toast.error("Couldn't update the account", {
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    },

    onSuccess: (user) => {
      toast.success(`${user.fullName} is now ${user.isActive ? 'active' : 'deactivated'}`);
    },

    onSettled: (_data, _error, { userId }) => {
      void queryClient.invalidateQueries({ queryKey: ['users', 'list'] });
      void queryClient.invalidateQueries({ queryKey: ['users', userId] });
    },
  });
}
