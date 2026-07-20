'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { ChevronRight, CreditCard, Wallet } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';
import { QueryErrorState } from '@/components/shared/query-error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/format';
import { PAYMENT_STATUS_BADGE_VARIANT, PAYMENT_STATUS_LABELS } from '@/lib/order-status';
import { cn } from '@/lib/utils';
import type { OrderDto } from '../types';

interface PaymentsTableProps {
  orders: OrderDto[];
  studentNameById: Map<string, string>;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  onRetry: () => void;
  selectedOrderId: string | null;
  onSelectOrder: (id: string) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

const ROW_HEIGHT = 52;

/**
 * Architecturally identical to `OrdersTable`/`CanteensTable`/`UsersTable`
 * (virtualized, sticky header, keyboard nav) — a new component rather
 * than a literal reuse of `OrdersTable`, since the columns genuinely
 * differ (Payment Method here, Order Status/Canteen there); building on
 * `GET /kitchen/orders` (see ../types.ts) rather than a payments-specific
 * endpoint, since none exists.
 */
export function PaymentsTable({
  orders,
  studentNameById,
  isLoading,
  isFetching,
  isError,
  onRetry,
  selectedOrderId,
  onSelectOrder,
  hasActiveFilters,
  onClearFilters,
}: PaymentsTableProps) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  const columns = useMemo<ColumnDef<OrderDto>[]>(
    () => [
      {
        id: 'orderNumber',
        header: 'Order',
        size: 150,
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-foreground">{row.original.orderNumber}</p>
            <p className="font-mono text-xs text-muted-foreground">{row.original.pickupToken}</p>
          </div>
        ),
      },
      {
        id: 'student',
        header: 'Student',
        size: 180,
        cell: ({ row }) => (
          <span className="truncate text-muted-foreground">
            {studentNameById.get(row.original.studentId) ?? 'Loading…'}
          </span>
        ),
      },
      {
        id: 'amount',
        header: 'Amount',
        size: 100,
        cell: ({ row }) => (
          <span className="tabular-nums text-foreground">{formatCurrency(row.original.totalAmount)}</span>
        ),
      },
      {
        id: 'paymentStatus',
        header: 'Status',
        size: 130,
        cell: ({ row }) => (
          <Badge variant={PAYMENT_STATUS_BADGE_VARIANT[row.original.paymentStatus]}>
            {PAYMENT_STATUS_LABELS[row.original.paymentStatus]}
          </Badge>
        ),
      },
      {
        id: 'paymentMethod',
        header: 'Method',
        size: 100,
        cell: ({ row }) => (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            {row.original.paymentMethod === 'online' ? (
              <CreditCard className="size-3.5" />
            ) : (
              <Wallet className="size-3.5" />
            )}
            {row.original.paymentMethod === 'online' ? 'Online' : 'Cash'}
          </span>
        ),
      },
      {
        id: 'createdAt',
        header: 'Date',
        size: 130,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDistanceToNow(new Date(row.original.createdAt), { addSuffix: true })}
          </span>
        ),
      },
      {
        id: 'actions',
        size: 44,
        header: '',
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => {
              e.stopPropagation();
              onSelectOrder(row.original.id);
            }}
            aria-label={`View payment details for ${row.original.orderNumber}`}
          >
            <ChevronRight className="size-4" />
          </Button>
        ),
      },
    ],
    [studentNameById, onSelectOrder],
  );

  const table = useReactTable({
    data: orders,
    columns,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  });

  const rows = table.getRowModel().rows;

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
          icon={Wallet}
          title={hasActiveFilters ? 'No payments match these filters' : 'No payments yet'}
          description={
            hasActiveFilters
              ? 'Try widening the date range or clearing a filter.'
              : 'Payments will show up here as students place and pay for orders.'
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
        <span className="text-sm text-muted-foreground">
          {orders.length} payment{orders.length === 1 ? '' : 's'}
          {isFetching && <span className="text-xs"> · refreshing…</span>}
        </span>
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
                      'h-10 px-2 text-left align-middle text-xs font-medium text-muted-foreground select-none',
                      colIndex === 0 && 'sticky left-0 z-20 bg-card',
                    )}
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
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
              const isSelected = order.id === selectedOrderId;

              return (
                <tr
                  key={row.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(row.id, el);
                    else rowRefs.current.delete(row.id);
                  }}
                  tabIndex={virtualRow.index === focusedIndex ? 0 : -1}
                  onFocus={() => setFocusedIndex(virtualRow.index)}
                  onClick={() => onSelectOrder(order.id)}
                  aria-selected={isSelected}
                  className={cn(
                    'absolute top-0 left-0 flex w-full cursor-pointer items-center border-b border-border outline-none transition-colors hover:bg-muted/50 focus-visible:bg-accent',
                    isSelected && 'bg-accent',
                  )}
                  style={{ height: ROW_HEIGHT, transform: `translateY(${virtualRow.start}px)` }}
                >
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
