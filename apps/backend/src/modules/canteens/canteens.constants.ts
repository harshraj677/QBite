/**
 * Pagination defaults matching docs/API_SPECIFICATION.md §8 exactly
 * (default limit 20, hard cap 50). Sortable fields are an explicit
 * allow-list per API_SPECIFICATION.md §10 — both are indexed
 * (see canteen.model.ts), not an open-ended "sort by anything the
 * client asks for."
 */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export const CANTEEN_SORTABLE_FIELDS = ['name', 'createdAt'] as const;
export type CanteenSortableField = (typeof CANTEEN_SORTABLE_FIELDS)[number];
