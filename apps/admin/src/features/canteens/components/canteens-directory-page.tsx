'use client';

import { ChevronLeft, ChevronRight, ListFilter } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { PageHeader } from '@/components/shared/page-header';
import { useCanteensFilterState } from '../hooks/use-canteens-filter-state';
import { useCanteensQuery } from '../hooks/use-canteens-query';
import { CanteenDetailDrawer } from './canteen-detail-drawer';
import { CanteensFiltersPanel } from './canteens-filters-panel';
import { CanteensTable } from './canteens-table';

/** Structurally mirrors `UsersDirectoryPage` (filters + table + drawer) — same reused shape as this phase's "reuse Users/Orders table architecture" instruction. */
export function CanteensDirectoryPage() {
  const filterState = useCanteensFilterState();
  const { data, isPending, isFetching, isError, refetch } = useCanteensQuery(filterState.queryParams);
  const [selectedCanteenId, setSelectedCanteenId] = useState<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const hasActiveFilters = filterState.activeFilterCount > 0 || filterState.search.value.length > 0;
  const meta = data?.meta;
  const canteens = data?.data ?? [];

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
        title="Canteens"
        description="Every canteen on the platform — searchable, filterable, real-time."
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
        <CanteensFiltersPanel
          filters={filterState}
          className="hidden w-64 shrink-0 overflow-y-auto lg:block"
        />

        <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
          <SheetContent side="left" className="w-72 overflow-y-auto p-4">
            <SheetHeader className="sr-only">
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <CanteensFiltersPanel filters={filterState} />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <CanteensTable
            canteens={canteens}
            isLoading={isPending}
            isFetching={isFetching}
            isError={isError}
            onRetry={refetch}
            selectedCanteenId={selectedCanteenId}
            onSelectCanteen={setSelectedCanteenId}
            sortBy={filterState.sortBy.value}
            sortOrder={filterState.sortOrder.value}
            onSortChange={handleSortChange}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={filterState.resetFilters}
          />

          {meta && meta.total > 0 && (
            <div className="flex items-center justify-between border-t border-border px-3 py-2 text-sm text-muted-foreground">
              <span>
                Page {meta.page} · {meta.total} canteen{meta.total === 1 ? '' : 's'} total
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

      <CanteenDetailDrawer canteenId={selectedCanteenId} onClose={() => setSelectedCanteenId(null)} />
    </div>
  );
}
