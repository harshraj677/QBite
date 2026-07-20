'use client';

import { formatDistanceToNow } from 'date-fns';
import { motion } from 'motion/react';
import { Activity, Ban, CheckCircle2, ChefHat, Clock3, PackageCheck, ShoppingBag } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMemo } from 'react';
import { WidgetCard } from '@/components/shared/widget-card';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useRecentOrders } from '../hooks/use-recent-orders';
import { deriveActivityEvents, type ActivityEventType } from '../utils/derive-activity';

const EVENT_META: Record<ActivityEventType, { icon: LucideIcon; label: string; color: string }> = {
  placed: { icon: ShoppingBag, label: 'placed', color: 'text-chart-1' },
  accepted: { icon: Clock3, label: 'accepted by the kitchen', color: 'text-chart-2' },
  preparing: { icon: ChefHat, label: 'started preparing', color: 'text-chart-3' },
  ready: { icon: PackageCheck, label: 'ready for pickup', color: 'text-chart-4' },
  completed: { icon: CheckCircle2, label: 'completed', color: 'text-success' },
  cancelled: { icon: Ban, label: 'cancelled', color: 'text-destructive' },
};

/**
 * Derived, not fetched — see utils/derive-activity.ts's doc comment
 * for why (no activity-log/event-stream endpoint exists on the
 * backend). Reuses the exact same `GET /kitchen/orders` response the
 * Recent Orders table renders — same `useRecentOrders` query, so this
 * costs zero extra network requests; the two widgets are just two
 * different views of one payload.
 */
export function LiveActivityTimeline() {
  const { data: orders, isPending, isError, refetch } = useRecentOrders(20);

  const events = useMemo(() => deriveActivityEvents(orders ?? [], 15), [orders]);

  return (
    <WidgetCard
      title="Live activity"
      description="Order lifecycle events, most recent first"
      isLoading={isPending}
      isError={isError}
      onRetry={refetch}
      isEmpty={!isPending && events.length === 0}
      emptyIcon={Activity}
      emptyTitle="No activity yet"
      contentHeight="h-96"
    >
      <ol className="max-h-96 space-y-4 overflow-y-auto pr-1">
        {events.map((event, index) => {
          const meta = EVENT_META[event.type];
          const Icon = meta.icon;
          return (
            <motion.li
              key={event.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: index * 0.03 }}
              className="flex gap-3"
            >
              <div
                className={cn(
                  'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted',
                  meta.color,
                )}
              >
                <Icon className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1 pb-4">
                <p className="text-sm text-foreground">
                  <span className="font-medium">{event.orderNumber}</span> {meta.label}
                  {event.type === 'placed' && (
                    <span className="text-muted-foreground"> · {formatCurrency(event.totalAmount)}</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                </p>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </WidgetCard>
  );
}
