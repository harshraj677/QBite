'use client';

import { useDraggable } from '@dnd-kit/core';
import { AlertTriangle, Check, Clock, StickyNote } from 'lucide-react';
import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { LoadingButton } from '@/components/shared/loading-button';
import { formatCurrency } from '@/lib/format';
import { ORDER_FORWARD_TRANSITIONS, ORDER_STATUS_LABELS, PAYMENT_STATUS_BADGE_VARIANT, PAYMENT_STATUS_LABELS } from '@/lib/order-status';
import { cn } from '@/lib/utils';
import { useAdvanceOrderStatus } from '@/features/orders/hooks/use-advance-order-status';
import { formatElapsed, getElapsedMinutes, getUrgencyLevel } from '../utils/elapsed-time';
import { PRIORITY_LABEL, URGENCY_CLASSES, derivePriority } from '../utils/priority';
import { useLiveClock } from '../hooks/use-live-clock';
import type { OrderWithItemsDto } from '../types';

interface KitchenOrderCardProps {
  order: OrderWithItemsDto;
  studentName?: string;
  selected: boolean;
  onToggleSelect: (orderId: string) => void;
  onOpenDetail: (orderId: string) => void;
  draggable?: boolean;
}

/**
 * The flagship unit of the whole page — large type, high-contrast
 * urgency color, and every field the spec asks for, with one
 * deliberate honesty note: "Priority" isn't a stored field (see
 * types.ts's doc comment) — it's the same real-timestamp-derived
 * urgency the timer color already shows, just labeled for scanability.
 */
function KitchenOrderCardImpl({
  order,
  studentName,
  selected,
  onToggleSelect,
  onOpenDetail,
  draggable = true,
}: KitchenOrderCardProps) {
  const now = useLiveClock();
  const advanceStatus = useAdvanceOrderStatus();
  const elapsedMinutes = getElapsedMinutes(order, now);
  const urgency = getUrgencyLevel(elapsedMinutes);
  const priority = derivePriority(urgency);
  const urgencyClasses = URGENCY_CLASSES[urgency];
  const nextStatus = ORDER_FORWARD_TRANSITIONS[order.status][0];

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order.id,
    data: { order },
    disabled: !draggable,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={
        transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
          : undefined
      }
      onClick={() => onOpenDetail(order.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpenDetail(order.id);
      }}
      className={cn(
        'group cursor-pointer touch-none space-y-3 rounded-xl bg-card p-4 shadow-sm ring-1 transition-shadow hover:shadow-md',
        urgencyClasses.ring,
        isDragging && 'opacity-50 shadow-lg',
        selected && 'ring-2 ring-primary',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect(order.id)}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={`Select order ${order.orderNumber}`}
          />
          <p className="text-lg leading-tight font-bold text-foreground">{order.orderNumber}</p>
        </div>
        <Badge variant={urgency === 'calm' ? 'secondary' : urgency === 'warning' ? 'warning' : 'destructive'}>
          {urgency !== 'calm' && <AlertTriangle className="size-3" />}
          {PRIORITY_LABEL[priority]}
        </Badge>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="truncate text-muted-foreground">{studentName ?? 'Loading student…'}</span>
        <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 font-mono text-sm font-semibold text-foreground">
          {order.pickupToken}
        </span>
      </div>

      <ul className="space-y-1 text-base">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-baseline gap-1.5 text-foreground">
            <span className="font-semibold tabular-nums">{item.quantity}×</span>
            <span className="truncate">{item.itemSnapshot.itemName}</span>
          </li>
        ))}
      </ul>

      {order.notes && (
        <p className="flex items-start gap-1.5 rounded-lg bg-muted px-2.5 py-2 text-sm text-foreground">
          <StickyNote className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          {order.notes}
        </p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Badge variant={PAYMENT_STATUS_BADGE_VARIANT[order.paymentStatus]}>
            {PAYMENT_STATUS_LABELS[order.paymentStatus]}
          </Badge>
          <span className="text-xs text-muted-foreground">{formatCurrency(order.totalAmount)}</span>
        </div>
        <span className={cn('flex items-center gap-1 text-sm font-semibold tabular-nums', urgencyClasses.text)}>
          <Clock className="size-3.5" />
          {formatElapsed(elapsedMinutes)}
        </span>
      </div>

      {nextStatus && (
        <LoadingButton
          className="w-full"
          size="sm"
          loading={advanceStatus.isPending && advanceStatus.variables?.orderId === order.id}
          onClick={(e) => {
            e.stopPropagation();
            advanceStatus.mutate({ orderId: order.id, toStatus: nextStatus });
          }}
        >
          <Check className="size-3.5" />
          Mark as {ORDER_STATUS_LABELS[nextStatus]}
        </LoadingButton>
      )}
    </div>
  );
}

/**
 * Memoized on its own props (order/studentName/selected/draggable) —
 * this does *not* stop the per-tick re-render from `useLiveClock`
 * (every card legitimately needs that, to advance its own timer); what
 * it stops is a re-render cascading down from the *board*'s own state
 * changes (selection of a *different* card, a filter change) when
 * this particular card's own inputs haven't changed.
 */
export const KitchenOrderCard = memo(KitchenOrderCardImpl, (prev, next) => {
  return (
    prev.order === next.order &&
    prev.studentName === next.studentName &&
    prev.selected === next.selected &&
    prev.draggable === next.draggable
  );
});
