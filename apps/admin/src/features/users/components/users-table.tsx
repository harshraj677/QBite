'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import {
  type ColumnDef,
  type RowSelectionState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, ShieldCheck, ShieldX, Users } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';
import { QueryErrorState } from '@/components/shared/query-error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { getInitials } from '@/lib/format';
import { USER_ROLE_BADGE_VARIANT, USER_ROLE_LABELS } from '@/lib/user-role';
import { cn } from '@/lib/utils';
import type { UserDto, UserSortableField } from '../types';

interface UsersTableProps {
  users: UserDto[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  onRetry: () => void;
  selectedUserId: string | null;
  onSelectUser: (id: string) => void;
  sortBy: UserSortableField;
  sortOrder: 'asc' | 'desc';
  onSortChange: (field: UserSortableField) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
}

const ROW_HEIGHT = 56;

export function UsersTable({
  users,
  isLoading,
  isFetching,
  isError,
  onRetry,
  selectedUserId,
  onSelectUser,
  sortBy,
  sortOrder,
  onSortChange,
  hasActiveFilters,
  onClearFilters,
  selectedIds,
  onSelectionChange,
}: UsersTableProps) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [focusedIndex, setFocusedIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  // Keep the internal table selection in sync with `selectedIds` when it
  // changes from outside (e.g. the bulk actions bar's "Clear").
  useEffect(() => {
    const next: RowSelectionState = {};
    selectedIds.forEach((id) => {
      next[id] = true;
    });
    setRowSelection(next);
  }, [selectedIds]);

  function handleRowSelectionChange(updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)) {
    setRowSelection((old) => {
      const next = typeof updater === 'function' ? updater(old) : updater;
      onSelectionChange(new Set(Object.keys(next).filter((id) => next[id])));
      return next;
    });
  }

  const columns = useMemo<ColumnDef<UserDto>[]>(
    () => [
      {
        id: 'select',
        size: 40,
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllRowsSelected()}
            indeterminate={table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected()}
            onCheckedChange={(checked) => table.toggleAllRowsSelected(checked === true)}
            aria-label="Select all users"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => row.toggleSelected(checked === true)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${row.original.fullName}`}
          />
        ),
      },
      {
        id: 'fullName',
        header: 'Name',
        size: 260,
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <Avatar size="sm">
              <AvatarFallback>{getInitials(row.original.fullName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{row.original.fullName}</p>
              {row.original.usn && (
                <p className="truncate text-xs text-muted-foreground">{row.original.usn}</p>
              )}
            </div>
          </div>
        ),
      },
      {
        id: 'collegeEmail',
        header: 'Contact',
        size: 240,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-foreground">{row.original.collegeEmail}</p>
            <p className="truncate text-xs text-muted-foreground">{row.original.phoneNumber}</p>
          </div>
        ),
      },
      {
        id: 'role',
        header: 'Role',
        size: 130,
        cell: ({ row }) => (
          <Badge variant={USER_ROLE_BADGE_VARIANT[row.original.role]}>
            {USER_ROLE_LABELS[row.original.role]}
          </Badge>
        ),
      },
      {
        id: 'verification',
        header: 'Verified',
        size: 100,
        cell: ({ row }) =>
          row.original.isEmailVerified ? (
            <span className="flex items-center gap-1 text-success">
              <ShieldCheck className="size-4" />
            </span>
          ) : (
            <span className="flex items-center gap-1 text-muted-foreground">
              <ShieldX className="size-4" />
            </span>
          ),
      },
      {
        id: 'status',
        header: 'Status',
        size: 110,
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? 'success' : 'destructive'}>
            {row.original.isActive ? 'Active' : 'Deactivated'}
          </Badge>
        ),
      },
      {
        id: 'createdAt',
        header: 'Joined',
        size: 140,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDistanceToNow(new Date(row.original.createdAt), { addSuffix: true })}
          </span>
        ),
      },
      {
        id: 'lastLoginAt',
        header: 'Last active',
        size: 140,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.lastLoginAt
              ? formatDistanceToNow(new Date(row.original.lastLoginAt), { addSuffix: true })
              : 'Never'}
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
              onSelectUser(row.original.id);
            }}
            aria-label={`View details for ${row.original.fullName}`}
          >
            <ChevronRight className="size-4" />
          </Button>
        ),
      },
    ],
    [onSelectUser],
  );

  const table = useReactTable({
    data: users,
    columns,
    getRowId: (row) => row.id,
    state: { rowSelection },
    onRowSelectionChange: handleRowSelectionChange,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
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
      if (row) onSelectUser(row.original.id);
    } else if (event.key === ' ') {
      event.preventDefault();
      const row = rows[focusedIndex];
      row?.toggleSelected();
    }
  }

  const SORTABLE_HEADERS: Partial<Record<string, UserSortableField>> = {
    fullName: 'fullName',
    collegeEmail: 'collegeEmail',
    createdAt: 'createdAt',
    lastLoginAt: 'lastLoginAt',
  };

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
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

  if (users.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState
          icon={Users}
          title={hasActiveFilters ? 'No users match these filters' : 'No users yet'}
          description={
            hasActiveFilters
              ? 'Try widening a filter or clearing the search.'
              : 'Registered accounts will show up here.'
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
            <span>{users.length} users</span>
          )}
          {isFetching && <span className="text-xs">· refreshing…</span>}
        </div>
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
              const user = row.original;
              const isSelectedForDrawer = user.id === selectedUserId;

              return (
                <tr
                  key={row.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(row.id, el);
                    else rowRefs.current.delete(row.id);
                  }}
                  tabIndex={virtualRow.index === focusedIndex ? 0 : -1}
                  onFocus={() => setFocusedIndex(virtualRow.index)}
                  onClick={() => onSelectUser(user.id)}
                  aria-selected={isSelectedForDrawer}
                  className={cn(
                    'absolute top-0 left-0 flex w-full cursor-pointer items-center border-b border-border outline-none transition-colors hover:bg-muted/50 focus-visible:bg-accent',
                    isSelectedForDrawer && 'bg-accent',
                    row.getIsSelected() && 'bg-primary/5',
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
