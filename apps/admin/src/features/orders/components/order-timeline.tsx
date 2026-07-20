'use client';

import { format, formatDistanceToNow } from 'date-fns';
import { motion } from 'motion/react';
import { Ban, Check } from 'lucide-react';
import { ORDER_STATUS_LABELS } from '@/lib/order-status';
import { cn } from '@/lib/utils';
import type { OrderStatus, OrderWithItemsDto } from '../types';

const STEPS: Array<{ status: OrderStatus; field: 'createdAt' | 'acceptedAt' | 'preparingAt' | 'readyAt' | 'completedAt' }> = [
  { status: 'pending', field: 'createdAt' },
  { status: 'accepted', field: 'acceptedAt' },
  { status: 'preparing', field: 'preparingAt' },
  { status: 'ready', field: 'readyAt' },
  { status: 'completed', field: 'completedAt' },
];

/** Real timestamps only — a step with no timestamp renders as "not yet reached," never a guessed/interpolated time. Animates in top-to-bottom on mount; each already-reached step gets a filled dot and a connecting line to the next reached step. */
export function OrderTimeline({ order }: { order: OrderWithItemsDto }) {
  return (
    <ol className="space-y-0">
      {STEPS.map((step, index) => {
        const timestamp = order[step.field];
        const reached = Boolean(timestamp);
        const isLast = index === STEPS.length - 1 && !order.cancelledAt;

        return (
          <motion.li
            key={step.status}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, delay: index * 0.06 }}
            className="relative flex gap-3 pb-6 last:pb-0"
          >
            {!isLast && (
              <span
                className={cn(
                  'absolute top-5 left-[9px] h-full w-px',
                  reached ? 'bg-success' : 'bg-border',
                )}
                aria-hidden
              />
            )}
            <span
              className={cn(
                'z-10 mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border-2',
                reached ? 'border-success bg-success text-success-foreground' : 'border-border bg-card',
              )}
            >
              {reached && <Check className="size-3" strokeWidth={3} />}
            </span>
            <div className="min-w-0 flex-1 pt-px">
              <p className={cn('text-sm font-medium', reached ? 'text-foreground' : 'text-muted-foreground')}>
                {ORDER_STATUS_LABELS[step.status]}
              </p>
              {timestamp && (
                <p className="text-xs text-muted-foreground">
                  {format(new Date(timestamp), 'MMM d, h:mm a')} ·{' '}
                  {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
                </p>
              )}
            </div>
          </motion.li>
        );
      })}

      {order.cancelledAt && (
        <motion.li
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          className="relative flex gap-3"
        >
          <span className="z-10 mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border-2 border-destructive bg-destructive text-destructive-foreground">
            <Ban className="size-3" strokeWidth={3} />
          </span>
          <div className="min-w-0 flex-1 pt-px">
            <p className="text-sm font-medium text-destructive">Cancelled</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(order.cancelledAt), 'MMM d, h:mm a')} ·{' '}
              {formatDistanceToNow(new Date(order.cancelledAt), { addSuffix: true })}
            </p>
            {order.cancellationReason && (
              <p className="mt-1 text-xs text-muted-foreground">Reason: {order.cancellationReason}</p>
            )}
          </div>
        </motion.li>
      )}
    </ol>
  );
}
