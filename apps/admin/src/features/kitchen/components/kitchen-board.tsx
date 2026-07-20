'use client';

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { ChefHat } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { QueryErrorState } from '@/components/shared/query-error-state';
import { ORDER_FORWARD_TRANSITIONS, ORDER_STATUS_LABELS } from '@/lib/order-status';
import { useAdvanceOrderStatus } from '@/features/orders/hooks/use-advance-order-status';
import { useBoardStudentNames } from '../hooks/use-board-student-names';
import { KITCHEN_BOARD_STATUSES, type OrderStatus, type OrderWithItemsDto } from '../types';
import { KitchenColumn } from './kitchen-column';
import { KitchenOrderCard } from './kitchen-order-card';

const COLUMN_ACCENT: Record<OrderStatus, string> = {
  pending: 'border-chart-1',
  accepted: 'border-chart-2',
  preparing: 'border-chart-3',
  ready: 'border-chart-4',
  completed: 'border-success',
  cancelled: 'border-destructive',
};

interface KitchenBoardProps {
  orders: OrderWithItemsDto[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  selectedIds: Set<string>;
  onToggleSelect: (orderId: string) => void;
  onOpenDetail: (orderId: string) => void;
}

export function KitchenBoard({
  orders,
  isLoading,
  isError,
  onRetry,
  selectedIds,
  onToggleSelect,
  onOpenDetail,
}: KitchenBoardProps) {
  const studentNames = useBoardStudentNames(orders);
  const advanceStatus = useAdvanceOrderStatus();
  const [draggingOrder, setDraggingOrder] = useState<OrderWithItemsDto | null>(null);

  // Requires a small pointer movement before a drag starts, so a plain
  // click/tap (to open the detail drawer, or tap the checkbox) never
  // gets mistaken for the start of a drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const ordersByStatus = useMemo(() => {
    const grouped = new Map<OrderStatus, OrderWithItemsDto[]>();
    for (const status of KITCHEN_BOARD_STATUSES) grouped.set(status, []);
    for (const order of orders) {
      if (KITCHEN_BOARD_STATUSES.includes(order.status as (typeof KITCHEN_BOARD_STATUSES)[number])) {
        grouped.get(order.status)?.push(order);
      }
    }
    return grouped;
  }, [orders]);

  const legalTargetForDragging = draggingOrder
    ? ORDER_FORWARD_TRANSITIONS[draggingOrder.status][0]
    : null;

  function handleDragStart(event: DragStartEvent) {
    const order = event.active.data.current?.order as OrderWithItemsDto | undefined;
    if (order) setDraggingOrder(order);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingOrder(null);
    const order = event.active.data.current?.order as OrderWithItemsDto | undefined;
    const targetStatus = event.over?.id as OrderStatus | undefined;
    if (!order || !targetStatus || targetStatus === order.status) return;

    const legalNext = ORDER_FORWARD_TRANSITIONS[order.status][0];
    if (targetStatus !== legalNext) {
      toast.error('That move isn’t allowed', {
        description: legalNext
          ? `${order.orderNumber} can only move to "${ORDER_STATUS_LABELS[legalNext]}" next.`
          : `${order.orderNumber} is already in its final stage.`,
      });
      return;
    }

    advanceStatus.mutate({ orderId: order.id, toStatus: targetStatus });
  }

  if (isLoading) {
    return (
      <div className="flex h-full gap-4 overflow-x-auto">
        {KITCHEN_BOARD_STATUSES.map((status) => (
          <div key={status} className="w-72 shrink-0 space-y-3 sm:w-80">
            <Skeleton className="h-10 w-full rounded-t-xl" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center">
        <QueryErrorState onRetry={onRetry} />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <EmptyState
          icon={ChefHat}
          title="The kitchen queue is empty"
          description="New orders will appear here the moment students place them."
        />
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-full gap-4 overflow-x-auto pb-2">
        {KITCHEN_BOARD_STATUSES.map((status) => {
          const columnOrders = ordersByStatus.get(status) ?? [];
          return (
            <KitchenColumn
              key={status}
              status={status}
              title={ORDER_STATUS_LABELS[status]}
              count={columnOrders.length}
              accentClassName={COLUMN_ACCENT[status]}
              isValidDropTarget={draggingOrder !== null && legalTargetForDragging === status}
            >
              {columnOrders.length === 0 ? (
                <p className="px-1 py-6 text-center text-sm text-muted-foreground">No orders</p>
              ) : (
                columnOrders.map((order) => (
                  <KitchenOrderCard
                    key={order.id}
                    order={order}
                    studentName={studentNames.get(order.studentId)}
                    selected={selectedIds.has(order.id)}
                    onToggleSelect={onToggleSelect}
                    onOpenDetail={onOpenDetail}
                  />
                ))
              )}
            </KitchenColumn>
          );
        })}
      </div>
      <DragOverlay>
        {draggingOrder && (
          <div className="w-72 rotate-2 opacity-90 sm:w-80">
            <KitchenOrderCard
              order={draggingOrder}
              studentName={studentNames.get(draggingOrder.studentId)}
              selected={false}
              onToggleSelect={() => {}}
              onOpenDetail={() => {}}
              draggable={false}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
