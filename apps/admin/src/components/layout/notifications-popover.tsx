'use client';

import { Bell } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { EmptyState } from '@/components/shared/empty-state';
import { useUnreadCount } from '@/features/notifications/hooks/use-unread-count';

export function NotificationsPopover() {
  const { data } = useUnreadCount();
  const count = data?.count ?? 0;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ''}`} className="relative">
            <Bell className="size-4" />
            {count > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] tabular-nums"
              >
                {count > 99 ? '99+' : count}
              </Badge>
            )}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80 p-0">
        <PopoverHeader className="border-b px-4 py-3">
          <PopoverTitle className="text-sm">Notifications</PopoverTitle>
          <PopoverDescription className="sr-only">Your recent notifications</PopoverDescription>
        </PopoverHeader>
        <div className="p-2">
          <EmptyState
            icon={Bell}
            title="Nothing to preview here yet"
            description="The full notifications feed is coming in the next phase."
            className="border-none py-8"
          />
        </div>
        <div className="border-t p-2">
          <Button variant="ghost" size="sm" className="w-full justify-center" render={<Link href="/notifications" />}>
            View all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
