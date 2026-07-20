'use client';

import { useQuery } from '@tanstack/react-query';
import { Bell, CheckCheck, MailOpen } from 'lucide-react';
import { StatCard } from '@/components/shared/stat-card';
import { getNotifications } from '../api';
import { useUnreadCount } from '../hooks/use-unread-count';

/**
 * "Analytics: reuse existing notification endpoints only, no backend
 * changes" — both numbers here come from real, already-existing reads:
 * `GET /notifications/unread-count` (the same endpoint the sidebar
 * bell already polls) for Unread, and `GET /notifications?limit=1`'s
 * real `meta.total` (unfiltered) for Total. Read is arithmetic on the
 * two, not a third request.
 */
export function NotificationsStatsStrip() {
  const unread = useUnreadCount();
  const total = useQuery({
    queryKey: ['notifications', 'total-count'],
    queryFn: () => getNotifications({ page: 1, limit: 1, sortOrder: 'desc' }),
    staleTime: 15_000,
  });

  const totalCount = total.data?.meta?.total;
  const unreadCount = unread.data?.count;
  const readCount =
    totalCount !== undefined && unreadCount !== undefined ? totalCount - unreadCount : undefined;
  const isLoading = total.isPending || unread.isPending;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard label="Total notifications" icon={Bell} loading={isLoading} value={totalCount ?? '—'} />
      <StatCard label="Unread" icon={MailOpen} loading={isLoading} value={unreadCount ?? '—'} />
      <StatCard label="Read" icon={CheckCheck} loading={isLoading} value={readCount ?? '—'} />
    </div>
  );
}
