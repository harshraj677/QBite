'use client';

import { motion } from 'motion/react';
import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ORDER_STATUS_LABELS } from '@/lib/order-status';
import { useAdvanceOrderStatus } from '@/features/orders/hooks/use-advance-order-status';
import type { OrderStatus, OrderWithItemsDto } from '../types';

interface BulkActionsBarProps {
  selectedOrders: OrderWithItemsDto[];
  onClear: () => void;
}

const BULK_ACTIONS: Array<{ fromStatus: OrderStatus; toStatus: OrderStatus; label: string }> = [
  { fromStatus: 'pending', toStatus: 'accepted', label: 'Accept all' },
  { fromStatus: 'accepted', toStatus: 'preparing', label: 'Mark preparing' },
  { fromStatus: 'preparing', toStatus: 'ready', label: 'Mark ready' },
  { fromStatus: 'ready', toStatus: 'completed', label: 'Complete' },
];

/**
 * Each button only ever acts on the *eligible subset* of the current
 * selection — "Accept all" advances the selected `pending` orders and
 * silently leaves the rest of the selection untouched, rather than
 * either failing the whole batch or accepting something that isn't
 * legally acceptable. The count on each button is exactly how many
 * orders it would actually affect, so a disabled/zero button is never
 * a mystery.
 */
export function BulkActionsBar({ selectedOrders, onClear }: BulkActionsBarProps) {
  const advanceStatus = useAdvanceOrderStatus();
  const [runningAction, setRunningAction] = useState<OrderStatus | null>(null);

  if (selectedOrders.length === 0) return null;

  async function runBulkAction(action: (typeof BULK_ACTIONS)[number]) {
    const eligible = selectedOrders.filter((o) => o.status === action.fromStatus);
    if (eligible.length === 0) return;

    setRunningAction(action.toStatus);
    const results = await Promise.allSettled(
      eligible.map((order) => advanceStatus.mutateAsync({ orderId: order.id, toStatus: action.toStatus })),
    );
    setRunningAction(null);

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - succeeded;
    if (succeeded > 0) {
      toast.success(`${succeeded} order${succeeded === 1 ? '' : 's'} marked as ${ORDER_STATUS_LABELS[action.toStatus].toLowerCase()}`);
    }
    if (failed > 0) {
      toast.error(`${failed} order${failed === 1 ? '' : 's'} couldn't be updated`);
    }
    onClear();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="flex flex-wrap items-center gap-2 rounded-xl bg-card px-3 py-2 shadow-lg ring-1 ring-foreground/10"
    >
      <span className="text-sm font-medium text-foreground">{selectedOrders.length} selected</span>
      <Separator orientation="vertical" className="h-5" />
      {BULK_ACTIONS.map((action) => {
        const eligibleCount = selectedOrders.filter((o) => o.status === action.fromStatus).length;
        return (
          <Button
            key={action.toStatus}
            variant="outline"
            size="sm"
            disabled={eligibleCount === 0 || runningAction !== null}
            onClick={() => runBulkAction(action)}
          >
            <Check className="size-3.5" />
            {action.label}
            {eligibleCount > 0 && <span className="tabular-nums opacity-70">({eligibleCount})</span>}
          </Button>
        );
      })}
      <Separator orientation="vertical" className="h-5" />
      <Button variant="ghost" size="sm" onClick={onClear}>
        <X className="size-3.5" />
        Clear
      </Button>
    </motion.div>
  );
}
