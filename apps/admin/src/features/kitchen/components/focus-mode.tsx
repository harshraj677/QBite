'use client';

import { motion, AnimatePresence } from 'motion/react';
import { ChefHat, Check, ChevronLeft, ChevronRight, Clock, StickyNote } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';
import { LoadingButton } from '@/components/shared/loading-button';
import { formatCurrency } from '@/lib/format';
import { ORDER_FORWARD_TRANSITIONS, ORDER_STATUS_LABELS, PAYMENT_STATUS_BADGE_VARIANT, PAYMENT_STATUS_LABELS } from '@/lib/order-status';
import { cn } from '@/lib/utils';
import { useAdvanceOrderStatus } from '@/features/orders/hooks/use-advance-order-status';
import { useBoardStudentNames } from '../hooks/use-board-student-names';
import { useLiveClock } from '../hooks/use-live-clock';
import { formatElapsed, getElapsedMinutes, getUrgencyLevel } from '../utils/elapsed-time';
import { PRIORITY_LABEL, URGENCY_CLASSES, derivePriority } from '../utils/priority';
import type { OrderWithItemsDto } from '../types';

interface FocusModeProps {
  orders: OrderWithItemsDto[];
  onOpenDetail: (orderId: string) => void;
}

/**
 * One order, as large as the screen allows — for a single-cook station
 * or a small tablet where the 5-column board doesn't fit. Steps
 * through `orders` in the order they're given (oldest-first, same as
 * the board); advancing an order's status removes it from the list
 * this component receives, which naturally moves focus to the next
 * ticket without any extra "did this order leave the queue" logic
 * here.
 */
export function FocusMode({ orders, onOpenDetail }: FocusModeProps) {
  const [rawIndex, setRawIndex] = useState(0);
  const now = useLiveClock();
  const advanceStatus = useAdvanceOrderStatus();
  const studentNames = useBoardStudentNames(orders);

  // Derived, not stored — if the queue shrinks out from under `rawIndex`
  // (an order left the board mid-focus), the displayed position clamps
  // back into range on the very next render, with no effect/setState
  // round-trip needed to "fix" it.
  const index = Math.min(rawIndex, Math.max(orders.length - 1, 0));

  if (orders.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState icon={ChefHat} title="Nothing to focus on" description="The queue is empty." />
      </div>
    );
  }

  const order = orders[index];
  const elapsedMinutes = getElapsedMinutes(order, now);
  const urgency = getUrgencyLevel(elapsedMinutes);
  const priority = derivePriority(urgency);
  const urgencyClasses = URGENCY_CLASSES[urgency];
  const nextStatus = ORDER_FORWARD_TRANSITIONS[order.status][0];

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-6">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => setRawIndex(Math.max(0, index - 1))}
          disabled={index === 0}
          aria-label="Previous order"
        >
          <ChevronLeft className="size-4" />
        </Button>
        Order {index + 1} of {orders.length}
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => setRawIndex(Math.min(orders.length - 1, index + 1))}
          disabled={index === orders.length - 1}
          aria-label="Next order"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={order.id}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className={cn('w-full max-w-xl space-y-6 rounded-2xl bg-card p-8 shadow-lg ring-2', urgencyClasses.ring)}
        >
          <div className="flex items-start justify-between">
            <div>
              <button
                onClick={() => onOpenDetail(order.id)}
                className="text-4xl font-bold text-foreground hover:underline"
              >
                {order.orderNumber}
              </button>
              <p className="mt-1 text-lg text-muted-foreground">
                {studentNames.get(order.studentId) ?? 'Loading student…'}
              </p>
            </div>
            <Badge
              variant={urgency === 'calm' ? 'secondary' : urgency === 'warning' ? 'warning' : 'destructive'}
              className="text-sm"
            >
              {PRIORITY_LABEL[priority]}
            </Badge>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3">
            <span className="font-mono text-2xl font-bold text-foreground">{order.pickupToken}</span>
            <span className={cn('flex items-center gap-2 text-2xl font-bold tabular-nums', urgencyClasses.text)}>
              <Clock className="size-6" />
              {formatElapsed(elapsedMinutes)}
            </span>
          </div>

          <ul className="space-y-2">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-baseline gap-2 text-xl text-foreground">
                <span className="font-bold tabular-nums">{item.quantity}×</span>
                <span>{item.itemSnapshot.itemName}</span>
              </li>
            ))}
          </ul>

          {order.notes && (
            <p className="flex items-start gap-2 rounded-xl bg-muted px-4 py-3 text-base text-foreground">
              <StickyNote className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              {order.notes}
            </p>
          )}

          <div className="flex items-center gap-2">
            <Badge variant={PAYMENT_STATUS_BADGE_VARIANT[order.paymentStatus]}>
              {PAYMENT_STATUS_LABELS[order.paymentStatus]}
            </Badge>
            <span className="text-sm text-muted-foreground">{formatCurrency(order.totalAmount)}</span>
          </div>

          {nextStatus && (
            <LoadingButton
              size="lg"
              className="w-full text-base"
              loading={advanceStatus.isPending && advanceStatus.variables?.orderId === order.id}
              onClick={() => advanceStatus.mutate({ orderId: order.id, toStatus: nextStatus })}
            >
              <Check className="size-5" />
              Mark as {ORDER_STATUS_LABELS[nextStatus]}
            </LoadingButton>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
