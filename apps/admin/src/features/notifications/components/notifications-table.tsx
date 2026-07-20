'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Check, ChevronRight, Trash2 } from 'lucide-react';
import { memo, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';
import { QueryErrorState } from '@/components/shared/query-error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { NOTIFICATION_TYPE_BADGE_VARIANT, NOTIFICATION_TYPE_LABELS } from '@/lib/notification-type';
import { cn } from '@/lib/utils';
import type { NotificationDto } from '../types';

interface NotificationsTableProps {
  notifications: NotificationDto[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  onRetry: () => void;
  selectedNotificationId: string | null;
  onSelectNotification: (id: string) => void;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

const ROW_HEIGHT = 68;

/** The title/message/type cell, memoized independently of the table shell — same reasoning as Menu's `NameCell`. */
const ContentCell = memo(function ContentCell({ notification }: { notification: NotificationDto }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <span
        className={cn(
          'mt-1.5 size-2 shrink-0 rounded-full',
          notification.isRead ? 'bg-transparent' : 'bg-primary',
        )}
        aria-hidden
      />
      <div className="min-w-0">
        <p className={cn('truncate', notification.isRead ? 'text-foreground' : 'font-semibold text-foreground')}>
          {notification.title}
        </p>
        <p className="truncate text-xs text-muted-foreground">{notification.message}</p>
      </div>
    </div>
  );
});

export function NotificationsTable({
  notifications,
  isLoading,
  isFetching,
  isError,
  onRetry,
  selectedNotificationId,
  onSelectNotification,
  onMarkRead,
  onDelete,
  hasActiveFilters,
  onClearFilters,
}: NotificationsTableProps) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  const columns = useMemo<ColumnDef<NotificationDto>[]>(
    () => [
      {
        id: 'content',
        header: 'Notification',
        size: 360,
        cell: ({ row }) => <ContentCell notification={row.original} />,
      },
      {
        id: 'type',
        header: 'Type',
        size: 150,
        cell: ({ row }) => (
          <Badge variant={NOTIFICATION_TYPE_BADGE_VARIANT[row.original.type]}>
            {NOTIFICATION_TYPE_LABELS[row.original.type]}
          </Badge>
        ),
      },
      {
        id: 'createdAt',
        header: 'Received',
        size: 130,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDistanceToNow(new Date(row.original.createdAt), { addSuffix: true })}
          </span>
        ),
      },
      {
        id: 'actions',
        size: 100,
        header: '',
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            {!row.original.isRead && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkRead(row.original.id);
                }}
                aria-label="Mark as read"
              >
                <Check className="size-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(row.original.id);
              }}
              aria-label="Delete notification"
            >
              <Trash2 className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => {
                e.stopPropagation();
                onSelectNotification(row.original.id);
              }}
              aria-label={`View details for ${row.original.title}`}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ),
      },
    ],
    [onMarkRead, onDelete, onSelectNotification],
  );

  const table = useReactTable({
    data: notifications,
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
      if (row) onSelectNotification(row.original.id);
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

  if (notifications.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState
          icon={Bell}
          title={hasActiveFilters ? 'No notifications match these filters' : "You're all caught up"}
          description={
            hasActiveFilters
              ? 'Try widening a filter or clearing the search.'
              : 'New notifications will show up here as they arrive.'
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
          {notifications.length} notification{notifications.length === 1 ? '' : 's'}
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
              const notification = row.original;
              const isSelected = notification.id === selectedNotificationId;

              return (
                <tr
                  key={row.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(row.id, el);
                    else rowRefs.current.delete(row.id);
                  }}
                  tabIndex={virtualRow.index === focusedIndex ? 0 : -1}
                  onFocus={() => setFocusedIndex(virtualRow.index)}
                  onClick={() => onSelectNotification(notification.id)}
                  aria-selected={isSelected}
                  className={cn(
                    'absolute top-0 left-0 flex w-full cursor-pointer items-center border-b border-border outline-none transition-colors hover:bg-muted/50 focus-visible:bg-accent',
                    isSelected && 'bg-accent',
                    !notification.isRead && 'bg-primary/5',
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
