import { useMemo, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import type { CanteenSortableField, CanteensQueryParams } from '../types';

const PAGE_SIZE = 20;

export function useCanteensFilterState() {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isOpen, setIsOpen] = useState<boolean>();
  const [sortBy, setSortBy] = useState<CanteenSortableField>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const debounceSearch = useDebouncedCallback((value: string) => {
    setDebouncedSearch(value);
    setPage(1);
  }, 300);

  function updateSearch(value: string) {
    setSearchInput(value);
    debounceSearch(value);
  }

  function setIsOpenAndResetPage(value: boolean | undefined) {
    setIsOpen(value);
    setPage(1);
  }

  const activeFilterCount = [isOpen].filter((v) => v !== undefined).length;

  function resetFilters() {
    setSearchInput('');
    setDebouncedSearch('');
    setIsOpen(undefined);
    setPage(1);
  }

  const queryParams: CanteensQueryParams = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      isOpen,
      sortBy,
      sortOrder,
      page,
      limit: PAGE_SIZE,
    }),
    [debouncedSearch, isOpen, sortBy, sortOrder, page],
  );

  return {
    queryParams,
    activeFilterCount,
    search: { value: searchInput, set: updateSearch },
    isOpen: { value: isOpen, set: setIsOpenAndResetPage },
    sortBy: { value: sortBy, set: setSortBy },
    sortOrder: { value: sortOrder, set: setSortOrder },
    page: { value: page, set: setPage },
    resetFilters,
  };
}

export type CanteensFilterState = ReturnType<typeof useCanteensFilterState>;
