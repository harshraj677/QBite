import { apiFetch, apiFetchData, type ApiResult, type QueryValue } from '@/lib/api/client';
import { getStudent } from '@/features/orders/api';
import type { UserDto, UserRole, UsersQueryParams } from './types';

/** `GET /users` — real server-side pagination/search/filter/sort, added for this phase (see ARCHITECTURE.md's Users Management note — the first list surface `modules/users` ever had). */
export function getUsers(params: UsersQueryParams): Promise<ApiResult<UserDto[]>> {
  return apiFetch<UserDto[]>('/users', { query: params as unknown as Record<string, QueryValue> });
}

/** `GET /users/:id` — same endpoint the Operations Center's Student section already calls; reused as-is rather than redeclared (it already unwraps the `{ user }` response envelope correctly). */
export const getUserDetail = getStudent;

/** `PATCH /users/:id/role` — legality-guarded server-side (self-change, role-hierarchy, last-super_admin-standing; see UsersService.updateRole). */
export async function updateUserRole(id: string, role: UserRole): Promise<UserDto> {
  const { user } = await apiFetchData<{ user: UserDto }>(`/users/${id}/role`, {
    method: 'PATCH',
    body: { role },
  });
  return user;
}

/** `PATCH /users/:id/status` — legality-guarded server-side (self-change, last-active-admin-standing; see UsersService.setActive). */
export async function updateUserStatus(id: string, isActive: boolean): Promise<UserDto> {
  const { user } = await apiFetchData<{ user: UserDto }>(`/users/${id}/status`, {
    method: 'PATCH',
    body: { isActive },
  });
  return user;
}
