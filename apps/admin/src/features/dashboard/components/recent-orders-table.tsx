'use client';

import { formatDistanceToNow } from 'date-fns';
import { Eye, Search, ShoppingBag } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { WidgetCard } from '@/components/shared/widget-card';
import { formatCurrency } from '@/lib/format';
import { useCanteenNameMap } from '../hooks/use-canteen-name-map';
import { useRecentOrders } from '../hooks/use-recent-orders';
import { ORDER_STATUS_BADGE_VARIANT, ORDER_STATUS_LABELS, PAYMENT_STATUS_BADGE_VARIANT, PAYMENT_STATUS_LABELS } from '@/lib/order-status';

interface RecentOrdersTableProps {
  onViewOrder: (orderId: string) => void;
}

export function RecentOrdersTable({ onViewOrder }: RecentOrdersTableProps) {
  const { data: orders, isPending, isError, refetch } = useRecentOrders(20);
  const { nameById } = useCanteenNameMap();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!orders) return [];
    const query = search.trim().toLowerCase();
    if (!query) return orders;
    return orders.filter((order) => {
      const canteenName = nameById.get(order.canteenId)?.toLowerCase() ?? '';
      return order.orderNumber.toLowerCase().includes(query) || canteenName.includes(query);
    });
  }, [orders, search, nameById]);

  return (
    <WidgetCard
      title="Recent orders"
      description="Latest orders across every canteen"
      isLoading={isPending}
      isError={isError}
      onRetry={refetch}
      isEmpty={!isPending && orders?.length === 0}
      emptyIcon={ShoppingBag}
      emptyTitle="No orders yet"
      emptyDescription="Orders placed by students will show up here."
      contentHeight="h-96"
      actions={
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search order # or canteen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-48 pl-8 sm:w-64"
            aria-label="Search recent orders"
          />
        </div>
      }
    >
      {filtered.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          No orders match &ldquo;{search}&rdquo;.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Canteen</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Placed</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium text-foreground">{order.orderNumber}</TableCell>
                <TableCell className="text-muted-foreground">
                  {nameById.get(order.canteenId) ?? '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={ORDER_STATUS_BADGE_VARIANT[order.status]}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={PAYMENT_STATUS_BADGE_VARIANT[order.paymentStatus]}>
                    {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums text-foreground">
                  {formatCurrency(order.totalAmount)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewOrder(order.id)}
                    aria-label={`View details for order ${order.orderNumber}`}
                  >
                    <Eye className="size-3.5" />
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </WidgetCard>
  );
}
