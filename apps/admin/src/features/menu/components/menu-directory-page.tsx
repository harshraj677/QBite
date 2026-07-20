'use client';

import { ChevronLeft, ChevronRight, ListFilter } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { PageHeader } from '@/components/shared/page-header';
import { useCanteensPicker } from '../hooks/use-canteens-picker';
import { useCategoriesQuery } from '../hooks/use-categories-query';
import { useMenuFilterState } from '../hooks/use-menu-filter-state';
import { useMenuItemsQuery } from '../hooks/use-menu-items-query';
import { MenuFiltersPanel } from './menu-filters-panel';
import { MenuItemDetailDrawer } from './menu-item-detail-drawer';
import { MenuItemsTable } from './menu-items-table';

/**
 * Structurally mirrors `UsersDirectoryPage`/`CanteensDirectoryPage`
 * (filters + table + drawer) — this phase's "reuse Users/Canteens
 * table architecture" instruction. The one structural difference: a
 * canteen picker gates everything else, since a menu is inherently
 * scoped to one canteen on this backend (see ARCHITECTURE.md's Menu
 * Management note).
 */
export function MenuDirectoryPage() {
  const canteensPicker = useCanteensPicker();
  const filterState = useMenuFilterState();
  const canteens = canteensPicker.data?.data ?? [];

  // Default to the first canteen once the picker loads — mirrors a
  // real admin's first action anyway ("pick a canteen"), just done for
  // them so the page isn't a dead end on first load.
  useEffect(() => {
    if (filterState.canteenId.value === undefined && canteens.length > 0) {
      filterState.canteenId.set(canteens[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canteens]);

  const categoriesQuery = useCategoriesQuery(filterState.canteenId.value);
  const { data, isPending, isFetching, isError, refetch } = useMenuItemsQuery(
    filterState.canteenId.value,
    filterState.queryParams,
  );

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const hasActiveFilters = filterState.activeFilterCount > 0 || filterState.search.value.length > 0;
  const meta = data?.meta;
  const items = data?.data ?? [];
  const selectedItem = items.find((i) => i.id === selectedItemId);
  const selectedCategoryName = selectedItem
    ? categoriesQuery.nameById.get(selectedItem.categoryId)
    : undefined;

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
        title="Menu Items"
        description="Every item in a canteen's menu — searchable, filterable, real-time."
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
        <MenuFiltersPanel
          filters={filterState}
          canteens={canteens}
          categories={categoriesQuery.categories}
          className="hidden w-64 shrink-0 overflow-y-auto lg:block"
        />

        <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
          <SheetContent side="left" className="w-72 overflow-y-auto p-4">
            <SheetHeader className="sr-only">
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <MenuFiltersPanel
              filters={filterState}
              canteens={canteens}
              categories={categoriesQuery.categories}
            />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <MenuItemsTable
            items={items}
            categoryNameById={categoriesQuery.nameById}
            isLoading={isPending || filterState.canteenId.value === undefined}
            isFetching={isFetching}
            isError={isError}
            onRetry={refetch}
            selectedItemId={selectedItemId}
            onSelectItem={setSelectedItemId}
            sortBy={filterState.sortBy.value}
            sortOrder={filterState.sortOrder.value}
            onSortChange={handleSortChange}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={filterState.resetFilters}
          />

          {meta && meta.total > 0 && (
            <div className="flex items-center justify-between border-t border-border px-3 py-2 text-sm text-muted-foreground">
              <span>
                Page {meta.page} · {meta.total} item{meta.total === 1 ? '' : 's'} total
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

      <MenuItemDetailDrawer
        itemId={selectedItemId}
        categoryName={selectedCategoryName}
        onClose={() => setSelectedItemId(null)}
      />
    </div>
  );
}
