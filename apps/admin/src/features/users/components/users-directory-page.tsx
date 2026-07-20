'use client';

import { ChevronLeft, ChevronRight, ListFilter } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { PageHeader } from '@/components/shared/page-header';
import { useUsersFilterState } from '../hooks/use-users-filter-state';
import { useUsersQuery } from '../hooks/use-users-query';
import { BulkActionsBar } from './bulk-actions-bar';
import { UserDetailDrawer } from './user-detail-drawer';
import { UsersFiltersPanel } from './users-filters-panel';
import { UsersTable } from './users-table';
import type { UserRole } from '../types';

interface UsersDirectoryPageProps {
  title: string;
  description: string;
  /** Fixed for the whole page (Students) — never shown as an editable filter. */
  lockedRole?: UserRole;
  /** Selectable role filter options (Staff) — omitted entirely when `lockedRole` is set. */
  roleOptions?: UserRole[];
}

/**
 * Shared by both `/users/students` and `/users/staff` — two saved
 * "views" over the same real `GET /users` endpoint (see
 * use-users-filter-state.ts's `lockedRole` doc comment), not two
 * parallel features. Structurally mirrors the Operations Center's
 * `/orders` page (three-part layout: filters, table, drawer) —
 * reusing that established shape rather than inventing a new one.
 */
export function UsersDirectoryPage({
  title,
  description,
  lockedRole,
  roleOptions,
}: UsersDirectoryPageProps) {
  const filterState = useUsersFilterState({ lockedRole });
  const { data, isPending, isFetching, isError, refetch } = useUsersQuery(filterState.queryParams);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const hasActiveFilters = filterState.activeFilterCount > 0 || filterState.search.value.length > 0;
  const meta = data?.meta;
  const users = data?.data ?? [];
  const selectedUsers = users.filter((u) => selectedIds.has(u.id));

  function handleSortChange(field: typeof filterState.sortBy.value) {
    if (filterState.sortBy.value === field) {
      filterState.sortOrder.set(filterState.sortOrder.value === 'asc' ? 'desc' : 'asc');
    } else {
      filterState.sortBy.set(field);
      filterState.sortOrder.set('asc');
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden"
            onClick={() => setMobileFiltersOpen(true)}
          >
            <ListFilter className="size-3.5" />
            Filters
            {filterState.activeFilterCount > 0 && ` (${filterState.activeFilterCount})`}
          </Button>
        }
      />

      <div className="flex min-h-0 flex-1 gap-4">
        <UsersFiltersPanel
          filters={filterState}
          roleOptions={roleOptions}
          className="hidden w-64 shrink-0 overflow-y-auto lg:block"
        />

        <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
          <SheetContent side="left" className="w-72 overflow-y-auto p-4">
            <SheetHeader className="sr-only">
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <UsersFiltersPanel filters={filterState} roleOptions={roleOptions} />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col gap-2 overflow-hidden">
          {selectedUsers.length > 0 && (
            <BulkActionsBar selectedUsers={selectedUsers} onClear={() => setSelectedIds(new Set())} />
          )}

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl ring-1 ring-foreground/10">
            <UsersTable
              users={users}
              isLoading={isPending}
              isFetching={isFetching}
              isError={isError}
              onRetry={refetch}
              selectedUserId={selectedUserId}
              onSelectUser={setSelectedUserId}
              sortBy={filterState.sortBy.value}
              sortOrder={filterState.sortOrder.value}
              onSortChange={handleSortChange}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={filterState.resetFilters}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
            />

            {meta && meta.total > 0 && (
              <div className="flex items-center justify-between border-t border-border px-3 py-2 text-sm text-muted-foreground">
                <span>
                  Page {meta.page} · {meta.total} user{meta.total === 1 ? '' : 's'} total
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={meta.page <= 1}
                    onClick={() => filterState.page.set(meta.page - 1)}
                  >
                    <ChevronLeft className="size-3.5" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!meta.hasMore}
                    onClick={() => filterState.page.set(meta.page + 1)}
                  >
                    Next
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <UserDetailDrawer userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
    </div>
  );
}
