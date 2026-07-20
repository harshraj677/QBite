import { apiFetch, apiFetchData, type ApiResult, type QueryValue } from '@/lib/api/client';
import type { CanteenDto, CanteensQueryParams } from './types';

/** `GET /canteens` — real server-side pagination/search/filter/sort. `search` (name/location) was added for this phase (see ARCHITECTURE.md's Canteens Management note). */
export function getCanteens(params: CanteensQueryParams): Promise<ApiResult<CanteenDto[]>> {
  return apiFetch<CanteenDto[]>('/canteens', {
    query: params as unknown as Record<string, QueryValue>,
  });
}

/** `GET /canteens/:id` — unwraps the `{ canteen }` response envelope (see features/orders/api.ts's doc comment on why every single-resource endpoint needs this). */
export async function getCanteenDetail(id: string): Promise<CanteenDto> {
  const { canteen } = await apiFetchData<{ canteen: CanteenDto }>(`/canteens/${id}`);
  return canteen;
}

/** `PATCH /canteens/:id/status` — toggles `isOpen`; the backend has no request body and no third state (see ARCHITECTURE.md's Canteens Management note on why there's no "temporarily closed" option). */
export async function toggleCanteenStatus(id: string): Promise<CanteenDto> {
  const { canteen } = await apiFetchData<{ canteen: CanteenDto }>(`/canteens/${id}/status`, {
    method: 'PATCH',
  });
  return canteen;
}

/** `GET /canteens/:canteenId/menu-items?isAvailable=true` — reused only for its exact `meta.total`, powering the detail drawer's "Active Menu Items" stat. Not part of building Menu Management (out of scope this phase) — a single read for one stat card. */
export async function getActiveMenuItemCount(canteenId: string): Promise<number> {
  const { meta } = await apiFetch<unknown[]>(`/canteens/${canteenId}/menu-items`, {
    query: { isAvailable: true, page: 1, limit: 1 },
  });
  return meta?.total ?? 0;
}
