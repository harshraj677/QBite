'use client';

import { format } from 'date-fns';
import { Check, Clock, Mail, MessageSquare, Radio, ShieldCheck, Tag, Trash2, User } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { LoadingButton } from '@/components/shared/loading-button';
import { NotAvailableSection } from '@/features/orders/components/not-available-section';
import { ConfirmActionDialog } from '@/features/users/components/confirm-action-dialog';
import { NOTIFICATION_TYPE_BADGE_VARIANT, NOTIFICATION_TYPE_LABELS } from '@/lib/notification-type';
import { useAuth } from '@/providers/auth-provider';
import { useDeleteNotification } from '../hooks/use-delete-notification';
import { useMarkNotificationAsRead } from '../hooks/use-mark-notification-read';
import type { NotificationDto } from '../types';

interface NotificationDetailDrawerProps {
  notification: NotificationDto | null;
  onClose: () => void;
}

/**
 * Takes the notification object directly, not an id — there is no
 * `GET /notifications/:id` endpoint on this backend (list + unread-count
 * + read-all + mark-one-read + delete only), so the drawer is populated
 * from whichever row in the already-loaded table the admin clicked,
 * the same way a Kitchen board card already carries everything its
 * detail view needs.
 */
export function NotificationDetailDrawer({ notification, onClose }: NotificationDetailDrawerProps) {
  const { user: currentUser } = useAuth();
  const markRead = useMarkNotificationAsRead();
  const deleteNotification = useDeleteNotification();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <Sheet open={notification !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle className="flex items-center gap-2">
            {notification ? notification.title : 'Notification details'}
            {notification && (
              <Badge variant={notification.isRead ? 'secondary' : 'default'}>
                {notification.isRead ? 'Read' : 'Unread'}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            {notification
              ? `Received ${format(new Date(notification.createdAt), 'MMM d, yyyy · h:mm a')}`
              : ''}
          </SheetDescription>
        </SheetHeader>

        {notification && (
          <div className="space-y-6 px-6 py-4">
            <section>
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <MessageSquare className="size-4" />
                Message
              </h3>
              <p className="rounded-lg bg-muted px-3 py-2.5 text-sm text-foreground">
                {notification.message}
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Tag className="size-4" />
                Type
              </h3>
              <Badge variant={NOTIFICATION_TYPE_BADGE_VARIANT[notification.type]}>
                {NOTIFICATION_TYPE_LABELS[notification.type]}
              </Badge>
            </section>

            <Separator />

            <section>
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Clock className="size-4" />
                Created time
              </h3>
              <p className="rounded-lg bg-muted px-3 py-2.5 text-sm text-foreground">
                {format(new Date(notification.createdAt), 'MMM d, yyyy · h:mm a')}
              </p>
            </section>

            <Separator />

            <section>
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <User className="size-4" />
                Recipient
              </h3>
              <div className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2.5 text-sm text-foreground">
                <Mail className="size-3.5 text-muted-foreground" />
                {currentUser?.fullName ?? 'You'}
                <span className="text-xs text-muted-foreground">
                  — every notification endpoint on this backend is self-scoped; there is no
                  admin view of another user&apos;s notifications.
                </span>
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Radio className="size-4" />
                Delivery status
              </h3>
              <NotAvailableSection reason="This backend has no push/delivery tracking — notifications are in-app only, with no 'sent'/'delivered' state on the record." />
            </section>

            <Separator />

            <section>
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <ShieldCheck className="size-4" />
                Read status
              </h3>
              <div className="space-y-2">
                <Badge variant={notification.isRead ? 'secondary' : 'default'}>
                  {notification.isRead ? 'Read' : 'Unread'}
                </Badge>
                <div className="flex gap-2">
                  {!notification.isRead && (
                    <LoadingButton
                      size="sm"
                      className="flex-1"
                      loading={markRead.isPending}
                      onClick={() => markRead.mutate(notification.id)}
                    >
                      <Check className="size-3.5" />
                      Mark as read
                    </LoadingButton>
                  )}
                  <LoadingButton
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    loading={deleteNotification.isPending}
                    onClick={() => setConfirmingDelete(true)}
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </LoadingButton>
                </div>
              </div>
            </section>
          </div>
        )}
      </SheetContent>

      {notification && (
        <ConfirmActionDialog
          open={confirmingDelete}
          onOpenChange={setConfirmingDelete}
          title="Delete this notification?"
          description="This can't be undone — the notification is permanently removed, not archived."
          confirmLabel="Delete"
          destructive
          isPending={deleteNotification.isPending}
          onConfirm={() =>
            deleteNotification.mutate(notification.id, { onSuccess: onClose, onSettled: () => setConfirmingDelete(false) })
          }
        />
      )}
    </Sheet>
  );
}
