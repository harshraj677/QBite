'use client';

import { LayoutGrid, ListChecks, Maximize, Minimize, Rows3 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/page-header';
import { QueryErrorState } from '@/components/shared/query-error-state';
import { OrderDetailDrawer } from '@/features/orders/components/order-detail-drawer';
import { OrdersTable } from '@/features/orders/components/orders-table';
import { BulkActionsBar } from './bulk-actions-bar';
import { FocusMode } from './focus-mode';
import { KitchenBoard } from './kitchen-board';
import { KitchenFilterBar } from './kitchen-filter-bar';
import { LiveClockProvider, useLiveClock } from '../hooks/use-live-clock';
import { useFullscreen } from '../hooks/use-fullscreen';
import { useKitchenFilterState } from '../hooks/use-kitchen-filter-state';
import { useKitchenOrders } from '../hooks/use-kitchen-orders';
import { useKitchenShortcuts, type KitchenViewMode } from '../hooks/use-kitchen-shortcuts';
import { getElapsedMinutes, getUrgencyLevel } from '../utils/elapsed-time';
import { cn } from '@/lib/utils';
import type { OrderWithItemsDto } from '../types';

/**
 * The flagship page — Board/Table/Focus views over one live,
 * 10s-polled `GET /kitchen/orders?includeItems=true` query, plus a
 * real Fullscreen-API "TV mode" scoped to this page's own content
 * container (see use-fullscreen.ts) so it never has to touch the
 * shared, already-approved `(dashboard)/layout.tsx` shell.
 *
 * Extracted from `app/(dashboard)/kitchen/page.tsx` at RC1 — see
 * `features/orders/components/orders-operations-center.tsx`'s doc
 * comment for why (a client `page.tsx` can't export `metadata`, so
 * this page's browser tab was falling back to the site default
 * instead of "Kitchen · QBite Admin").
 */
export function KitchenOperationsPage() {
  return (
    <LiveClockProvider>
      <KitchenPageContent />
    </LiveClockProvider>
  );
}

const VIEW_ICONS: Record<KitchenViewMode, typeof LayoutGrid> = {
  board: LayoutGrid,
  table: Rows3,
  focus: ListChecks,
};

function KitchenPageContent() {
  const filterState = useKitchenFilterState();
  const kitchenOrders = useKitchenOrders(filterState.serverFilters);
  const now = useLiveClock();
  const {
    ref: fullscreenRef,
    isFullscreen,
    toggle: toggleFullscreen,
    exit: exitFullscreen,
  } = useFullscreen<HTMLDivElement>();

  const [viewMode, setViewMode] = useState<KitchenViewMode>('board');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tableSortOrder, setTableSortOrder] = useState<'asc' | 'desc'>('asc');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const allOrders = useMemo(() => kitchenOrders.data?.data ?? [], [kitchenOrders.data]);

  // The only client-side filter of the four (see use-kitchen-filter-state.ts) —
  // urgency has no backend concept to send, it's derived from the same
  // real timestamps the timer/priority already use.
  const orders = useMemo(() => {
    if (!filterState.timeFilter.value) return allOrders;
    return allOrders.filter(
      (order) => getUrgencyLevel(getElapsedMinutes(order, now)) === filterState.timeFilter.value,
    );
  }, [allOrders, filterState.timeFilter.value, now]);

  const tableOrders = tableSortOrder === 'asc' ? orders : [...orders].reverse();

  const selectedOrders = useMemo(
    () => orders.filter((order) => selectedIds.has(order.id)),
    [orders, selectedIds],
  );

  function toggleSelect(orderId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  useKitchenShortcuts({
    onFocusSearch: () => searchInputRef.current?.focus(),
    onToggleFullscreen: toggleFullscreen,
    onSetView: setViewMode,
    onEscape: () => {
      if (selectedOrderId) setSelectedOrderId(null);
      else if (selectedIds.size > 0) clearSelection();
      else if (isFullscreen) exitFullscreen();
    },
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {!isFullscreen && (
        <PageHeader
          title="Kitchen"
          description="Live order queue — accept, prepare, and complete tickets in real time."
        />
      )}

      <div
        ref={fullscreenRef}
        className={cn('flex min-h-0 flex-1 flex-col gap-3', isFullscreen && 'bg-background p-4')}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as KitchenViewMode)}>
              <TabsList>
                {(['board', 'table', 'focus'] as const).map((mode) => {
                  const Icon = VIEW_ICONS[mode];
                  return (
                    <TabsTrigger key={mode} value={mode} className="gap-1.5">
                      <Icon className="size-3.5" />
                      {mode === 'board' ? 'Board' : mode === 'table' ? 'Table' : 'Focus'}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
            <KitchenFilterBar filters={filterState} searchInputRef={searchInputRef} />
          </div>

          <Button variant="outline" size="sm" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize className="size-3.5" /> : <Maximize className="size-3.5" />}
            {isFullscreen ? 'Exit fullscreen' : 'Fullscreen (F)'}
          </Button>
        </div>

        {selectedOrders.length > 0 && (
          <BulkActionsBar selectedOrders={selectedOrders} onClear={clearSelection} />
        )}

        <div className="min-h-0 flex-1 rounded-xl ring-1 ring-foreground/10">
          {kitchenOrders.isError ? (
            <div className="flex h-full items-center justify-center">
              <QueryErrorState onRetry={() => kitchenOrders.refetch()} />
            </div>
          ) : viewMode === 'board' ? (
            <div className="h-full p-3">
              <KitchenBoard
                orders={orders}
                isLoading={kitchenOrders.isPending}
                isError={kitchenOrders.isError}
                onRetry={() => kitchenOrders.refetch()}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onOpenDetail={setSelectedOrderId}
              />
            </div>
          ) : viewMode === 'table' ? (
            <OrdersTable
              orders={tableOrders as OrderWithItemsDto[]}
              isLoading={kitchenOrders.isPending}
              isFetching={kitchenOrders.isFetching}
              isError={kitchenOrders.isError}
              onRetry={() => kitchenOrders.refetch()}
              searchQuery={filterState.search.value}
              selectedOrderId={selectedOrderId}
              onSelectOrder={setSelectedOrderId}
              sortOrder={tableSortOrder}
              onSortOrderChange={setTableSortOrder}
              hasActiveFilters={filterState.activeFilterCount > 0}
              onClearFilters={filterState.resetFilters}
            />
          ) : (
            <FocusMode orders={orders} onOpenDetail={setSelectedOrderId} />
          )}
        </div>
      </div>

      <OrderDetailDrawer orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
    </div>
  );
}
