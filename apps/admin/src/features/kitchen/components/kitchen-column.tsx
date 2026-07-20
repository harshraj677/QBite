'use client';

import { useDroppable } from '@dnd-kit/core';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { OrderStatus } from '../types';

interface KitchenColumnProps {
  status: OrderStatus;
  title: string;
  count: number;
  accentClassName: string;
  /** Whether *something* is currently being dragged that could legally land here — drives the "valid drop target" highlight independently of whether the pointer is hovering this exact column right now. */
  isValidDropTarget: boolean;
  children: ReactNode;
}

/** A droppable column — sticky header with an animated count, and a highlight ring that only appears while a legal drag is in flight over it (an illegal target never highlights, so "you can't drop here" is communicated before the drop, not after a rejection toast). */
export function KitchenColumn({
  status,
  title,
  count,
  accentClassName,
  isValidDropTarget,
  children,
}: KitchenColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { status } });

  return (
    <div className="flex min-h-0 w-72 shrink-0 flex-col sm:w-80">
      <div className={cn('sticky top-0 z-10 flex items-center justify-between rounded-t-xl border-b-2 bg-card px-3 py-2.5', accentClassName)}>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <Badge variant="secondary" className="tabular-nums">
          <motion.span key={count} initial={{ scale: 1.3 }} animate={{ scale: 1 }} transition={{ duration: 0.2 }}>
            {count}
          </motion.span>
        </Badge>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 space-y-3 overflow-y-auto rounded-b-xl bg-muted/30 p-3 transition-colors',
          isValidDropTarget && 'bg-primary/5 ring-2 ring-primary/30 ring-inset',
          isValidDropTarget && isOver && 'bg-primary/10 ring-primary/60',
        )}
      >
        {children}
      </div>
    </div>
  );
}
