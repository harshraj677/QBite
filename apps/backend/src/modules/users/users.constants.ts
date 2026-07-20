/** Pagination defaults match API_SPECIFICATION.md §8's convention (default 20, hard cap 50) — same values every other listable module uses (canteens, menu). */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export const USER_SORTABLE_FIELDS = [
  'fullName',
  'collegeEmail',
  'createdAt',
  'lastLoginAt',
] as const;
export type UserSortableField = (typeof USER_SORTABLE_FIELDS)[number];
