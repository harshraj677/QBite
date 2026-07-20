import { apiFetch, apiFetchData, type ApiResult, type QueryValue } from '@/lib/api/client';
import type { MenuCategoryDto, MenuItemDto, MenuItemsQueryParams } from './types';

/** `GET /canteens/:canteenId/menu-items` — real server-side pagination/search/category/veg/availability filters/sort, all pre-existing (no backend change needed for the Directory — see ARCHITECTURE.md's Menu Management note). */
export function getMenuItems(
  canteenId: string,
  params: MenuItemsQueryParams,
): Promise<ApiResult<MenuItemDto[]>> {
  return apiFetch<MenuItemDto[]>(`/canteens/${canteenId}/menu-items`, {
    query: params as unknown as Record<string, QueryValue>,
  });
}

/** `GET /menu-items/:id` — unwraps the `{ item }` response envelope. */
export async function getMenuItemDetail(id: string): Promise<MenuItemDto> {
  const { item } = await apiFetchData<{ item: MenuItemDto }>(`/menu-items/${id}`);
  return item;
}

/** `GET /canteens/:canteenId/categories` — reused for the category filter dropdown and the drawer's category-name lookup; a generous limit since a canteen's category count is small in practice (mirrors `useCanteenNameMap`'s reasoning). */
export function getCategories(canteenId: string): Promise<ApiResult<MenuCategoryDto[]>> {
  return apiFetch<MenuCategoryDto[]>(`/canteens/${canteenId}/categories`, {
    query: { page: 1, limit: 50, sortBy: 'displayOrder', sortOrder: 'asc' },
  });
}

/** `PATCH /menu-items/:id/availability` — the only availability-management endpoint that exists; also atomically clears `isFeatured` server-side when turned off. */
export async function updateMenuItemAvailability(
  id: string,
  isAvailable: boolean,
): Promise<MenuItemDto> {
  const { item } = await apiFetchData<{ item: MenuItemDto }>(`/menu-items/${id}/availability`, {
    method: 'PATCH',
    body: { isAvailable },
  });
  return item;
}
