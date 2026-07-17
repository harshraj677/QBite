/**
 * Shared by both entities in this module (MenuCategory + MenuItem are
 * two tightly-coupled halves of the same `menu` module — see
 * ARCHITECTURE.md's module-boundary note on `menu`). Pagination
 * defaults match the same API_SPECIFICATION.md §8 values `canteens`
 * uses (default 20, hard cap 50) — duplicated rather than imported
 * from `canteens.constants.ts` to keep the two modules independent.
 */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export const MENU_CATEGORY_SORTABLE_FIELDS = ['name', 'displayOrder', 'createdAt'] as const;
export type MenuCategorySortableField = (typeof MENU_CATEGORY_SORTABLE_FIELDS)[number];

export const MENU_ITEM_SORTABLE_FIELDS = ['name', 'price', 'displayOrder', 'createdAt'] as const;
export type MenuItemSortableField = (typeof MENU_ITEM_SORTABLE_FIELDS)[number];
