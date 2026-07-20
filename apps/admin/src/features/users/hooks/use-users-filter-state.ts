import { useMemo, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import type { UserRole, UserSortableField, UsersQueryParams } from '../types';

const PAGE_SIZE = 20;

interface UseUsersFilterStateOptions {
  /** Students vs Staff are two different pages over the same collection (see nav-config.ts's Directory section) — a locked role bakes itself into every query and is never shown as an editable filter, rather than the page needing its own parallel state/query logic. */
  lockedRole?: UserRole;
}

export function useUsersFilterState({ lockedRole }: UseUsersFilterStateOptions = {}) {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [role, setRole] = useState<UserRole>();
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>();
  const [isActive, setIsActive] = useState<boolean>();
  const [sortBy, setSortBy] = useState<UserSortableField>('createdAt');
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

  function setRoleAndResetPage(value: UserRole | undefined) {
    setRole(value);
    setPage(1);
  }
  function setIsEmailVerifiedAndResetPage(value: boolean | undefined) {
    setIsEmailVerified(value);
    setPage(1);
  }
  function setIsActiveAndResetPage(value: boolean | undefined) {
    setIsActive(value);
    setPage(1);
  }

  const activeFilterCount = [
    lockedRole ? undefined : role,
    isEmailVerified,
    isActive,
  ].filter((v) => v !== undefined).length;

  function resetFilters() {
    setSearchInput('');
    setDebouncedSearch('');
    setRole(undefined);
    setIsEmailVerified(undefined);
    setIsActive(undefined);
    setPage(1);
  }

  const queryParams: UsersQueryParams = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      role: lockedRole ?? role,
      isEmailVerified,
      isActive,
      sortBy,
      sortOrder,
      page,
      limit: PAGE_SIZE,
    }),
    [debouncedSearch, lockedRole, role, isEmailVerified, isActive, sortBy, sortOrder, page],
  );

  return {
    queryParams,
    activeFilterCount,
    search: { value: searchInput, set: updateSearch },
    role: { value: role, set: setRoleAndResetPage },
    isEmailVerified: { value: isEmailVerified, set: setIsEmailVerifiedAndResetPage },
    isActive: { value: isActive, set: setIsActiveAndResetPage },
    sortBy: { value: sortBy, set: setSortBy },
    sortOrder: { value: sortOrder, set: setSortOrder },
    page: { value: page, set: setPage },
    resetFilters,
  };
}

export type UsersFilterState = ReturnType<typeof useUsersFilterState>;
