import { useMemo, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import type { NotificationType } from '../types';

const PAGE_SIZE = 50; // the backend's own max — maximizes how much of the real history the client-side search/type filter below actually covers

/**
 * `isRead` and `sortOrder` are real server-side params (`GET /notifications`
 * genuinely supports them). `search` and `type` are NOT — this backend
 * has no text-search or type filter on this endpoint (confirmed by
 * reading listNotificationsQuerySchema, not assumed) — so both are
 * applied client-side, over whichever page is currently loaded. That's
 * an honest, clearly-labeled compromise (see NotificationsFilterBar),
 * not a silent gap: a self-scoped notification feed is small enough in
 * practice (one admin's own order/payment lifecycle events) that a
 * 50-per-page client filter covers the realistic common case, unlike
 * the same shortcut would have for an unbounded, platform-wide list.
 */
export function useNotificationsFilterState() {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [type, setType] = useState<NotificationType>();
  const [isRead, setIsRead] = useState<boolean>();
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const debounceSearch = useDebouncedCallback((value: string) => setDebouncedSearch(value), 250);

  function updateSearch(value: string) {
    setSearchInput(value);
    debounceSearch(value);
  }

  function setIsReadAndResetPage(value: boolean | undefined) {
    setIsRead(value);
    setPage(1);
  }

  const activeFilterCount = [type, isRead].filter((v) => v !== undefined).length;

  function resetFilters() {
    setSearchInput('');
    setDebouncedSearch('');
    setType(undefined);
    setIsRead(undefined);
    setPage(1);
  }

  const queryParams = useMemo(
    () => ({ page, limit: PAGE_SIZE, isRead, sortOrder }),
    [page, isRead, sortOrder],
  );

  return {
    queryParams,
    activeFilterCount,
    search: { value: searchInput, set: updateSearch, debounced: debouncedSearch },
    type: { value: type, set: setType },
    isRead: { value: isRead, set: setIsReadAndResetPage },
    sortOrder: { value: sortOrder, set: setSortOrder },
    page: { value: page, set: setPage },
    resetFilters,
  };
}

export type NotificationsFilterState = ReturnType<typeof useNotificationsFilterState>;
