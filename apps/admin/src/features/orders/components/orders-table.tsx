'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import {
  type ColumnDef,
  type ColumnSizingState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronRight,
  Columns3,
  Copy,
  Eye,
  ShoppingBag,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { QueryErrorState } from '@/components/shared/query-error-state';
import { EmptyState } from '@/components/shared/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useCanteenNameMap } from '@/features/dashboard/hooks/use-canteen-name-map';
import {
  ORDER_FORWARD_TRANSITIONS,
  ORDER_STATUS_BADGE_VARIANT,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_BADGE_VARIANT,
  PAYMENT_STATUS_LABELS,
} from '@/lib/order-status';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAdvanceOrderStatus } from '../hooks/use-advance-order-status';
import type { OrderDto } from '../types';
import { HighlightMatch } from '../utils/highlight-match';

interface OrdersTableProps {
  orders: OrderDto[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  onRetry: () => void;
  searchQuery: string;
  selectedOrderId: string | null;
  onSelectOrder: (id: string) => void;
  sortOrder: 'asc' | 'desc';
  onSortOrderChange: (order: 'asc' | 'desc') => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

const ROW_HEIGHT = 44;

/**
 * "Sortable" columns other than Placed are client-side, over the
 * currently-loaded page only — the backend only sorts by `createdAt`
 * (`sortOrder`, see kitchen.validation.ts). This is a common,
 * well-understood enterprise-table pattern (server controls what page
 * you're on; client sort orders what's already there), not a silent
 * downgrade the way a client-side *filter* would be — sorting doesn't
 * change which rows are in view, only their order.
 */
export function OrdersTable({
  orders,
  isLoading,
  isFetching,
  isError,
  onRetry,
  searchQuery,
  selectedOrderId,
  onSelectOrder,
  sortOrder,
  onSortOrderChange,
  hasActiveFilters,
  onClearFilters,
}: OrdersTableProps) {
  const { nameById } = useCanteenNameMap();
  const advanceStatus = useAdvanceOrderStatus();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  function copyOrderNumber(orderNumber: string) {
    void navigator.clipboard.writeText(orderNumber);
    toast.success('Order number copied');
  }

  const columns = useMemo<ColumnDef<OrderDto>[]>(
    () => [
      {
        id: 'select',
        size: 40,
        enableResizing: false,
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllRowsSelected()}
            indeterminate={table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected()}
            onCheckedChange={(checked) => table.toggleAllRowsSelected(checked === true)}
            aria-label="Select all orders"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => row.toggleSelected(checked === true)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select order ${row.original.orderNumber}`}
          />
        ),
      },
      {
        accessorKey: 'orderNumber',
        header: 'Order',
        size: 160,
        cell: ({ row }) => (
          <span className="font-medium text-foreground">
            <HighlightMatch text={row.original.orderNumber} query={searchQuery} />
          </span>
        ),
      },
      {
        id: 'canteen',
        header: 'Canteen',
        size: 160,
        accessorFn: (order) => nameById.get(order.canteenId) ?? order.canteenId,
        cell: ({ getValue }) => (
          <span className="truncate text-muted-foreground">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        size: 130,
        enableSorting: true,
        cell: ({ getValue }) => {
          const status = getValue<OrderDto['status']>();
          return <Badge variant={ORDER_STATUS_BADGE_VARIANT[status]}>{ORDER_STATUS_LABELS[status]}</Badge>;
        },
      },
      {
        accessorKey: 'paymentStatus',
        header: 'Payment',
        size: 140,
        enableSorting: true,
        cell: ({ getValue }) => {
          const status = getValue<OrderDto['paymentStatus']>();
          return (
            <Badge variant={PAYMENT_STATUS_BADGE_VARIANT[status]}>
              {PAYMENT_STATUS_LABELS[status]}
            </Badge>
          );
        },
      },
      {
        accessorKey: 'totalAmount',
        header: 'Amount',
        size: 110,
        enableSorting: true,
        cell: ({ getValue }) => (
          <span className="tabular-nums text-foreground">{formatCurrency(getValue<number>())}</span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Placed',
        size: 130,
        enableSorting: true,
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">
            {formatDistanceToNow(new Date(getValue<string>()), { addSuffix: true })}
          </span>
        ),
      },
      {
        id: 'actions',
        size: 60,
        enableResizing: false,
        header: '',
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => {
              e.stopPropagation();
              onSelectOrder(row.original.id);
            }}
            aria-label={`View details for order ${row.original.orderNumber}`}
          >
            <ChevronRight className="size-4" />
          </Button>
        ),
      },
    ],
    [nameById, searchQuery, onSelectOrder],
  );

  const table = useReactTable({
    data: orders,
    columns,
    getRowId: (row) => row.id,
    state: { rowSelection, columnVisibility, columnSizing, sorting },
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnSizingChange: setColumnSizing,
    onSortingChange: setSorting,
    enableRowSelection: true,
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const selectedCount = Object.keys(rowSelection).length;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  function focusRow(index: number) {
    const clamped = Math.max(0, Math.min(rows.length - 1, index));
    setFocusedIndex(clamped);
    const row = rows[clamped];
    const el = row && rowRefs.current.get(row.id);
    el?.focus();
    virtualizer.scrollToIndex(clamped, { align: 'auto' });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTableSectionElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusRow(focusedIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusRow(focusedIndex - 1);
    } else if (event.key === 'Enter') {
      const row = rows[focusedIndex];
      if (row) onSelectOrder(row.original.id);
    } else if (event.key === ' ') {
      event.preventDefault();
      const row = rows[focusedIndex];
      row?.toggleSelected();
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center">
        <QueryErrorState onRetry={onRetry} />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState
          icon={ShoppingBag}
          title={hasActiveFilters ? 'No orders match these filters' : 'No orders yet'}
          description={
            hasActiveFilters
              ? 'Try widening the date range or clearing a filter.'
              : 'Orders placed by students will show up here in real time.'
          }
          action={
            hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={onClearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {selectedCount > 0 ? (
            <span className="font-medium text-foreground">{selectedCount} selected</span>
          ) : (
            <span>{orders.length} orders</span>
          )}
          {isFetching && <span className="text-xs">· refreshing…</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSortOrderChange(sortOrder === 'desc' ? 'asc' : 'desc')}
          >
            {sortOrder === 'desc' ? <ArrowDown className="size-3.5" /> : <ArrowUp className="size-3.5" />}
            {sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm">
                  <Columns3 className="size-3.5" />
                  Columns
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {table
                .getAllLeafColumns()
                .filter((column) => column.id !== 'select' && column.id !== 'actions')
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(checked) => column.toggleVisibility(checked === true)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div ref={scrollRef} className="relative flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm" style={{ width: table.getTotalSize() }}>
          <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_var(--border)]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header, colIndex) => (
                  <th
                    key={header.id}
                    className={cn(
                      'group/th relative h-10 px-2 text-left align-middle text-xs font-medium text-muted-foreground select-none',
                      colIndex === 0 && 'sticky left-0 z-20 bg-card',
                    )}
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className={cn(
                          'flex items-center gap-1',
                          header.column.getCanSort() && 'cursor-pointer hover:text-foreground',
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                        disabled={!header.column.getCanSort()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() &&
                          (header.column.getIsSorted() === 'asc' ? (
                            <ArrowUp className="size-3" />
                          ) : header.column.getIsSorted() === 'desc' ? (
                            <ArrowDown className="size-3" />
                          ) : (
                            <ArrowUpDown className="size-3 opacity-40" />
                          ))}
                      </button>
                    )}
                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className="absolute top-0 right-0 h-full w-1 cursor-col-resize touch-none select-none hover:bg-primary/40"
                      />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody
            onKeyDown={handleKeyDown}
            style={{ height: virtualizer.getTotalSize(), position: 'relative', display: 'block' }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              const order = row.original;
              const isSelectedForDrawer = order.id === selectedOrderId;
              const nextStatuses = ORDER_FORWARD_TRANSITIONS[order.status];

              return (
                <ContextMenu key={row.id}>
                  <ContextMenuTrigger
                    render={
                      <tr
                        ref={(el) => {
                          if (el) rowRefs.current.set(row.id, el);
                          else rowRefs.current.delete(row.id);
                        }}
                        tabIndex={virtualRow.index === focusedIndex ? 0 : -1}
                        onFocus={() => setFocusedIndex(virtualRow.index)}
                        onClick={() => onSelectOrder(order.id)}
                        aria-selected={isSelectedForDrawer}
                        className={cn(
                          'absolute top-0 left-0 flex w-full cursor-pointer items-center border-b border-border outline-none transition-colors hover:bg-muted/50 focus-visible:bg-accent',
                          isSelectedForDrawer && 'bg-accent',
                          row.getIsSelected() && 'bg-primary/5',
                        )}
                        style={{ height: ROW_HEIGHT, transform: `translateY(${virtualRow.start}px)` }}
                      />
                    }
                  >
                    <HoverCard>
                      <HoverCardTrigger render={<div className="contents" />}>
                        {row.getVisibleCells().map((cell, colIndex) => (
                          <td
                            key={cell.id}
                            className={cn(
                              'overflow-hidden px-2 text-ellipsis whitespace-nowrap',
                              colIndex === 0 && 'sticky left-0 z-1 bg-inherit',
                            )}
                            style={{ width: cell.column.getSize() }}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </HoverCardTrigger>
                      <HoverCardContent side="right" className="w-72">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-foreground">{order.orderNumber}</p>
                            <Badge variant={ORDER_STATUS_BADGE_VARIANT[order.status]}>
                              {ORDER_STATUS_LABELS[order.status]}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {nameById.get(order.canteenId) ?? order.canteenId}
                          </p>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Total</span>
                            <span className="font-medium tabular-nums">
                              {formatCurrency(order.totalAmount)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Pickup code</span>
                            <span className="font-mono">{order.pickupToken}</span>
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => onSelectOrder(order.id)}>
                      <Eye className="size-3.5" />
                      View details
                    </ContextMenuItem>
                    <ContextMenuItem onClick={() => copyOrderNumber(order.orderNumber)}>
                      <Copy className="size-3.5" />
                      Copy order number
                    </ContextMenuItem>
                    {nextStatuses.length > 0 && (
                      <>
                        <ContextMenuSeparator />
                        {nextStatuses.map((status) => (
                          <ContextMenuItem
                            key={status}
                            onClick={() =>
                              advanceStatus.mutate({ orderId: order.id, toStatus: status })
                            }
                          >
                            <Check className="size-3.5" />
                            Mark as {ORDER_STATUS_LABELS[status]}
                          </ContextMenuItem>
                        ))}
                      </>
                    )}
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
