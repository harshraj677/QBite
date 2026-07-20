import { useMemo, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import type { MenuItemSortableField, MenuItemsQueryParams } from '../types';

const PAGE_SIZE = 20;

/**
 * Menu items have no natural "across every canteen" list on this
 * backend (unlike Users/Canteens) — a menu is inherently scoped to one
 * canteen (see ARCHITECTURE.md's Menu Management note on why the
 * Directory is canteen-scoped, not a new unscoped endpoint). This hook
 * therefore owns `canteenId` as its first-class filter, alongside the
 * item-level filters `GET /canteens/:canteenId/menu-items` already
 * supports — changing canteen resets `categoryId` (categories don't
 * carry across canteens) and the page.
 */
export function useMenuFilterState() {
  const [canteenId, setCanteenIdState] = useState<string>();
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string>();
  const [isVeg, setIsVeg] = useState<boolean>();
  const [isAvailable, setIsAvailable] = useState<boolean>();
  const [sortBy, setSortBy] = useState<MenuItemSortableField>('displayOrder');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  const debounceSearch = useDebouncedCallback((value: string) => {
    setDebouncedSearch(value);
    setPage(1);
  }, 300);

  function updateSearch(value: string) {
    setSearchInput(value);
    debounceSearch(value);
  }

  function setCanteenId(value: string | undefined) {
    setCanteenIdState(value);
    setCategoryId(undefined);
    setPage(1);
  }
  function setCategoryIdAndResetPage(value: string | undefined) {
    setCategoryId(value);
    setPage(1);
  }
  function setIsVegAndResetPage(value: boolean | undefined) {
    setIsVeg(value);
    setPage(1);
  }
  function setIsAvailableAndResetPage(value: boolean | undefined) {
    setIsAvailable(value);
    setPage(1);
  }

  const activeFilterCount = [categoryId, isVeg, isAvailable].filter((v) => v !== undefined).length;

  function resetFilters() {
    setSearchInput('');
    setDebouncedSearch('');
    setCategoryId(undefined);
    setIsVeg(undefined);
    setIsAvailable(undefined);
    setPage(1);
  }

  const queryParams: MenuItemsQueryParams = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      categoryId,
      isVeg,
      isAvailable,
      sortBy,
      sortOrder,
      page,
      limit: PAGE_SIZE,
    }),
    [debouncedSearch, categoryId, isVeg, isAvailable, sortBy, sortOrder, page],
  );

  return {
    canteenId: { value: canteenId, set: setCanteenId },
    queryParams,
    activeFilterCount,
    search: { value: searchInput, set: updateSearch },
    categoryId: { value: categoryId, set: setCategoryIdAndResetPage },
    isVeg: { value: isVeg, set: setIsVegAndResetPage },
    isAvailable: { value: isAvailable, set: setIsAvailableAndResetPage },
    sortBy: { value: sortBy, set: setSortBy },
    sortOrder: { value: sortOrder, set: setSortOrder },
    page: { value: page, set: setPage },
    resetFilters,
  };
}

export type MenuFilterState = ReturnType<typeof useMenuFilterState>;
