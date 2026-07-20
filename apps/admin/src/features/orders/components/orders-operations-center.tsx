'use client';

import { ChevronLeft, ChevronRight, ListFilter } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { PageHeader } from '@/components/shared/page-header';
import { FiltersPanel } from './filters-panel';
import { OrderDetailDrawer } from './order-detail-drawer';
import { OrdersTable } from './orders-table';
import { useOrdersFilterState } from '../hooks/use-orders-filter-state';
import { useOrdersQuery } from '../hooks/use-orders-query';

/**
 * The Operations Center. Three panels — Filters (left, collapses into
 * a sheet below `lg`), the orders table (center), and the order
 * detail drawer (right, opens on demand) — all driven by one real,
 * server-side, server-paginated query. See ARCHITECTURE.md's
 * "Operations Center" note for the backend extension this page relies
 * on and the honest scope of what's real vs. derived throughout.
 *
 * Extracted from `app/(dashboard)/orders/page.tsx` at RC1 — moved
 * here, unchanged, so that page.tsx can become a server component and
 * export a real `metadata.title` (a client `page.tsx` can't export
 * metadata at all, which is why this page's browser tab previously
 * fell back to the site-wide default instead of "Orders · QBite
 * Admin" — see ARCHITECTURE.md's RC1 note). Same fix applied to
 * Kitchen, Dashboard, and Profile.
 */
export function OrdersOperationsCenter() {
  const filterState = useOrdersFilterState();
  const { data, isPending, isFetching, isError, refetch } = useOrdersQuery(filterState.queryParams);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const hasActiveFilters = filterState.activeFilterCount > 0 || filterState.search.value.length > 0;
  const meta = data?.meta;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader
        title="Orders"
        description="Every order across every canteen — real-time, searchable, filterable."
        actions={
          <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setMobileFiltersOpen(true)}>
            <ListFilter className="size-3.5" />
            Filters
            {filterState.activeFilterCount > 0 && ` (${filterState.activeFilterCount})`}
          </Button>
        }
      />

      <div className="flex min-h-0 flex-1 gap-4">
        <FiltersPanel filters={filterState} className="hidden w-64 shrink-0 overflow-y-auto lg:block" />

        <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
          <SheetContent side="left" className="w-72 overflow-y-auto p-4">
            <SheetHeader className="sr-only">
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <FiltersPanel filters={filterState} />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <OrdersTable
            orders={data?.data ?? []}
            isLoading={isPending}
            isFetching={isFetching}
            isError={isError}
            onRetry={refetch}
            searchQuery={filterState.search.value}
            selectedOrderId={selectedOrderId}
            onSelectOrder={setSelectedOrderId}
            sortOrder={filterState.sortOrder.value}
            onSortOrderChange={filterState.sortOrder.set}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={filterState.resetFilters}
          />

          {meta && meta.total > 0 && (
            <div className="flex items-center justify-between border-t border-border px-3 py-2 text-sm text-muted-foreground">
              <span>
                Page {meta.page} · {meta.total} order{meta.total === 1 ? '' : 's'} total
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

      <OrderDetailDrawer orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
    </div>
  );
}
