'use client';

import { formatDistanceToNow } from 'date-fns';
import { Check, Circle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { QueryErrorState } from '@/components/shared/query-error-state';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useOrderDetail } from '../hooks/use-recent-orders';
import {
  ORDER_STATUS_BADGE_VARIANT,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_BADGE_VARIANT,
  PAYMENT_STATUS_LABELS,
} from '@/lib/order-status';
import type { OrderStatus } from '../types';

const TIMELINE_STEPS: Array<{ status: OrderStatus; field: 'createdAt' | 'acceptedAt' | 'preparingAt' | 'readyAt' | 'completedAt' }> = [
  { status: 'pending', field: 'createdAt' },
  { status: 'accepted', field: 'acceptedAt' },
  { status: 'preparing', field: 'preparingAt' },
  { status: 'ready', field: 'readyAt' },
  { status: 'completed', field: 'completedAt' },
];

interface OrderDetailSheetProps {
  orderId: string | null;
  onClose: () => void;
}

/**
 * A read-only quick-look, not order management — no status-change
 * actions, no editing. That's a deliberate scope boundary: the full
 * Orders page (search/filter/bulk actions/status transitions) is
 * explicitly deferred to a later phase; this exists only so the
 * dashboard's "View details" button in the Recent Orders table opens
 * onto something real instead of a dead end.
 */
export function OrderDetailSheet({ orderId, onClose }: OrderDetailSheetProps) {
  const { data: order, isPending, isError, refetch } = useOrderDetail(orderId);

  return (
    <Sheet open={orderId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto p-6 sm:max-w-md">
        <SheetHeader className="p-0">
          <SheetTitle>{order ? order.orderNumber : 'Order details'}</SheetTitle>
          <SheetDescription>
            {order ? `Placed ${formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}` : 'Loading order…'}
          </SheetDescription>
        </SheetHeader>

        {isPending ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : isError ? (
          <QueryErrorState onRetry={refetch} />
        ) : order ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={ORDER_STATUS_BADGE_VARIANT[order.status]}>
                {ORDER_STATUS_LABELS[order.status]}
              </Badge>
              <Badge variant={PAYMENT_STATUS_BADGE_VARIANT[order.paymentStatus]}>
                {PAYMENT_STATUS_LABELS[order.paymentStatus]}
              </Badge>
              <Badge variant="outline">{order.paymentMethod === 'cash' ? 'Cash' : 'Online'}</Badge>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium text-foreground">Status timeline</p>
              <ol className="space-y-3">
                {TIMELINE_STEPS.map((step) => {
                  const timestamp = order[step.field];
                  const reached = Boolean(timestamp);
                  return (
                    <li key={step.status} className="flex items-center gap-3 text-sm">
                      {reached ? (
                        <Check className="size-4 shrink-0 text-success" />
                      ) : (
                        <Circle className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className={cn(reached ? 'text-foreground' : 'text-muted-foreground')}>
                        {ORDER_STATUS_LABELS[step.status]}
                      </span>
                      {timestamp && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
                        </span>
                      )}
                    </li>
                  );
                })}
                {order.cancelledAt && (
                  <li className="flex items-center gap-3 text-sm">
                    <Circle className="size-4 shrink-0 fill-destructive text-destructive" />
                    <span className="text-destructive">Cancelled</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(order.cancelledAt), { addSuffix: true })}
                    </span>
                  </li>
                )}
              </ol>
              {order.cancellationReason && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Reason: {order.cancellationReason}
                </p>
              )}
            </div>

            <Separator />

            <div>
              <p className="mb-3 text-sm font-medium text-foreground">Items</p>
              <ul className="space-y-2">
                {order.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {item.quantity}× {item.itemSnapshot.itemName}
                    </span>
                    <span className="font-medium tabular-nums text-foreground">
                      {formatCurrency(item.totalPrice)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <Separator />

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Tax</span>
                <span className="tabular-nums">{formatCurrency(order.tax)}</span>
              </div>
              <div className="flex justify-between font-medium text-foreground">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(order.totalAmount)}</span>
              </div>
            </div>

            <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              Pickup code <span className="font-mono font-semibold text-foreground">{order.pickupToken}</span>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
