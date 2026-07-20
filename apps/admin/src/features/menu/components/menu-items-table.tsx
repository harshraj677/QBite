'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Leaf, UtensilsCrossed } from 'lucide-react';
import { memo, useMemo, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';
import { QueryErrorState } from '@/components/shared/query-error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { MenuItemDto, MenuItemSortableField } from '../types';

interface MenuItemsTableProps {
  items: MenuItemDto[];
  categoryNameById: Map<string, string>;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  onRetry: () => void;
  selectedItemId: string | null;
  onSelectItem: (id: string) => void;
  sortBy: MenuItemSortableField;
  sortOrder: 'asc' | 'desc';
  onSortChange: (field: MenuItemSortableField) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

const ROW_HEIGHT = 60;
const SORTABLE_HEADERS: Partial<Record<string, MenuItemSortableField>> = {
  name: 'name',
  price: 'price',
  displayOrder: 'displayOrder',
  createdAt: 'createdAt',
};

/** A row's veg/name/price/availability cells, memoized independently of the table shell — mirrors `KitchenOrderCard`'s reasoning (the expensive part is per-row, not the table itself). */
const NameCell = memo(function NameCell({
  item,
  categoryName,
}: {
  item: MenuItemDto;
  categoryName: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar size="sm">
        <AvatarImage src={item.image} alt="" />
        <AvatarFallback>
          <UtensilsCrossed className="size-3.5" />
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{item.name}</p>
        <p className="truncate text-xs text-muted-foreground">{categoryName}</p>
      </div>
    </div>
  );
});

/**
 * Structurally mirrors `CanteensTable`/`UsersTable` (virtualized, sticky
 * header, server sort, keyboard nav) — this phase's "reuse Users/Canteens
 * table architecture" instruction, applied literally.
 */
export function MenuItemsTable({
  items,
  categoryNameById,
  isLoading,
  isFetching,
  isError,
  onRetry,
  selectedItemId,
  onSelectItem,
  sortBy,
  sortOrder,
  onSortChange,
  hasActiveFilters,
  onClearFilters,
}: MenuItemsTableProps) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  const columns = useMemo<ColumnDef<MenuItemDto>[]>(
    () => [
      {
        id: 'name',
        header: 'Item',
        size: 260,
        cell: ({ row }) => (
          <NameCell item={row.original} categoryName={categoryNameById.get(row.original.categoryId) ?? '—'} />
        ),
      },
      {
        id: 'price',
        header: 'Price',
        size: 100,
        cell: ({ row }) => (
          <span className="tabular-nums text-foreground">{formatCurrency(row.original.price)}</span>
        ),
      },
      {
        id: 'diet',
        header: 'Diet',
        size: 90,
        cell: ({ row }) =>
          row.original.isVeg ? (
            <Badge variant="success">
              <Leaf className="size-3" />
              Veg
            </Badge>
          ) : (
            <Badge variant="secondary">Non-veg</Badge>
          ),
      },
      {
        id: 'availability',
        header: 'Availability',
        size: 120,
        cell: ({ row }) => (
          <Badge variant={row.original.isAvailable ? 'success' : 'destructive'}>
            {row.original.isAvailable ? 'Available' : 'Unavailable'}
          </Badge>
        ),
      },
      {
        id: 'featured',
        header: 'Featured',
        size: 100,
        cell: ({ row }) =>
          row.original.isFeatured ? <Badge variant="warning">Featured</Badge> : null,
      },
      {
        id: 'displayOrder',
        header: 'Order',
        size: 80,
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">{row.original.displayOrder}</span>
        ),
      },
      {
        id: 'createdAt',
        header: 'Added',
        size: 110,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {new Date(row.original.createdAt).toLocaleDateString()}
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
              onSelectItem(row.original.id);
            }}
            aria-label={`View details for ${row.original.name}`}
          >
            <ChevronRight className="size-4" />
          </Button>
        ),
      },
    ],
    [categoryNameById, onSelectItem],
  );

  const table = useReactTable({
    data: items,
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
      if (row) onSelectItem(row.original.id);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
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

  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState
          icon={UtensilsCrossed}
          title={hasActiveFilters ? 'No items match these filters' : 'No menu items yet'}
          description={
            hasActiveFilters
              ? 'Try widening a filter or clearing the search.'
              : 'Items added to this canteen will show up here.'
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
          {items.length} item{items.length === 1 ? '' : 's'}
          {isFetching && <span className="text-xs"> · refreshing…</span>}
        </span>
      </div>

      <div ref={scrollRef} className="relative flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm" style={{ width: table.getTotalSize() }}>
          <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_var(--border)]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header, colIndex) => {
                  const sortField = SORTABLE_HEADERS[header.column.id];
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        'h-10 px-2 text-left align-middle text-xs font-medium text-muted-foreground select-none',
                        colIndex === 0 && 'sticky left-0 z-20 bg-card',
                      )}
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder ? null : sortField ? (
                        <button
                          type="button"
                          className="flex items-center gap-1 hover:text-foreground"
                          onClick={() => onSortChange(sortField)}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sortBy === sortField ? (
                            sortOrder === 'asc' ? (
                              <ArrowUp className="size-3" />
                            ) : (
                              <ArrowDown className="size-3" />
                            )
                          ) : (
                            <ArrowUpDown className="size-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody
            onKeyDown={handleKeyDown}
            style={{ height: virtualizer.getTotalSize(), position: 'relative', display: 'block' }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              const item = row.original;
              const isSelected = item.id === selectedItemId;

              return (
                <tr
                  key={row.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(row.id, el);
                    else rowRefs.current.delete(row.id);
                  }}
                  tabIndex={virtualRow.index === focusedIndex ? 0 : -1}
                  onFocus={() => setFocusedIndex(virtualRow.index)}
                  onClick={() => onSelectItem(item.id)}
                  aria-selected={isSelected}
                  className={cn(
                    'absolute top-0 left-0 flex w-full cursor-pointer items-center border-b border-border outline-none transition-colors hover:bg-muted/50 focus-visible:bg-accent',
                    isSelected && 'bg-accent',
                    !item.isAvailable && 'opacity-60',
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
