'use client';

import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { LoadingButton } from '@/components/shared/loading-button';
import { ConfirmActionDialog } from '@/features/users/components/confirm-action-dialog';
import { useMarkAllNotificationsAsRead } from '../hooks/use-mark-all-notifications-read';
import { useMarkNotificationAsRead } from '../hooks/use-mark-notification-read';
import { useDeleteNotification } from '../hooks/use-delete-notification';
import { useNotificationsFilterState } from '../hooks/use-notifications-filter-state';
import { useNotificationsQuery } from '../hooks/use-notifications-query';
import { useUnreadCount } from '../hooks/use-unread-count';
import { NotificationDetailDrawer } from './notification-detail-drawer';
import { NotificationsFilterBar } from './notifications-filter-bar';
import { NotificationsStatsStrip } from './notifications-stats-strip';
import { NotificationsTable } from './notifications-table';

/**
 * "Your" notification history, not a platform-wide admin console —
 * every endpoint this page calls is self-scoped to the logged-in
 * admin (see notifications.routes.ts's doc comment: "There is no
 * admin-any-user path"). Building this as if it showed every student's
 * notifications would have meant either fabricating data or a backend
 * change this phase explicitly forbids — see ARCHITECTURE.md's
 * Notifications Center note for the full reasoning.
 */
export function NotificationsCenterPage() {
  const filterState = useNotificationsFilterState();
  const { data, isPending, isFetching, isError, refetch } = useNotificationsQuery(filterState.queryParams);
  const unreadCount = useUnreadCount();
  const markRead = useMarkNotificationAsRead();
  const markAllRead = useMarkAllNotificationsAsRead();
  const deleteNotification = useDeleteNotification();

  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [confirmingMarkAll, setConfirmingMarkAll] = useState(false);

  const meta = data?.meta;

  // The only two filters this backend doesn't support server-side —
  // see use-notifications-filter-state.ts's doc comment.
  const notifications = useMemo(() => {
    const search = filterState.search.debounced.trim().toLowerCase();
    return (data?.data ?? []).filter((n) => {
      if (filterState.type.value && n.type !== filterState.type.value) return false;
      if (search && !n.title.toLowerCase().includes(search) && !n.message.toLowerCase().includes(search)) {
        return false;
      }
      return true;
    });
  }, [data, filterState.type.value, filterState.search.debounced]);

  const selectedNotification = notifications.find((n) => n.id === selectedNotificationId) ?? null;
  const hasActiveFilters =
    filterState.activeFilterCount > 0 || filterState.search.value.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader
        title="Notifications"
        description="Your notification history — order and payment updates, real-time."
        actions={
          <LoadingButton
            variant="outline"
            size="sm"
            disabled={(unreadCount.data?.count ?? 0) === 0}
            loading={markAllRead.isPending}
            onClick={() => setConfirmingMarkAll(true)}
          >
            <Check className="size-3.5" />
            Mark all as read
            {unreadCount.data && unreadCount.data.count > 0 && ` (${unreadCount.data.count})`}
          </LoadingButton>
        }
      />

      <NotificationsStatsStrip />

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        <NotificationsFilterBar filters={filterState} />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <NotificationsTable
            notifications={notifications}
            isLoading={isPending}
            isFetching={isFetching}
            isError={isError}
            onRetry={refetch}
            selectedNotificationId={selectedNotificationId}
            onSelectNotification={setSelectedNotificationId}
            onMarkRead={(id) => markRead.mutate(id)}
            onDelete={(id) => setConfirmingDeleteId(id)}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={filterState.resetFilters}
          />

          {meta && meta.total > 0 && (
            <div className="flex items-center justify-between border-t border-border px-3 py-2 text-sm text-muted-foreground">
              <span>
                Page {meta.page} · {meta.total} notification{meta.total === 1 ? '' : 's'} total
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

      <NotificationDetailDrawer
        notification={selectedNotification}
        onClose={() => setSelectedNotificationId(null)}
      />

      <ConfirmActionDialog
        open={confirmingDeleteId !== null}
        onOpenChange={(open) => !open && setConfirmingDeleteId(null)}
        title="Delete this notification?"
        description="This can't be undone — the notification is permanently removed, not archived."
        confirmLabel="Delete"
        destructive
        isPending={deleteNotification.isPending}
        onConfirm={() => {
          if (confirmingDeleteId) {
            deleteNotification.mutate(confirmingDeleteId, {
              onSettled: () => setConfirmingDeleteId(null),
            });
          }
        }}
      />

      <ConfirmActionDialog
        open={confirmingMarkAll}
        onOpenChange={setConfirmingMarkAll}
        title="Mark all notifications as read?"
        description={`All ${unreadCount.data?.count ?? 0} unread notifications will be marked as read.`}
        confirmLabel="Mark all as read"
        isPending={markAllRead.isPending}
        onConfirm={() => markAllRead.mutate(undefined, { onSettled: () => setConfirmingMarkAll(false) })}
      />
    </div>
  );
}
