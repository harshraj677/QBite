'use client';

import { motion } from 'motion/react';
import { Minus, TrendingDown, TrendingUp, UtensilsCrossed } from 'lucide-react';
import { WidgetCard } from '@/components/shared/widget-card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatCompactNumber, formatCurrency } from '@/lib/format';
import { useTopSellingItemsWithGrowth } from '../hooks/use-top-selling-items';

/**
 * No `image` field exists on `MenuItemSalesDto` — the menu-analytics
 * response is sales figures only, not a menu-catalog join. Rather
 * than fabricate a photo, each card gets an icon avatar (same
 * icon-in-colored-box language as StatCard/Logo elsewhere in this
 * app), tinted by a stable hash of the item name so repeat visits to
 * the same item always land on the same color.
 */
function itemAccentIndex(itemName: string): number {
  let hash = 0;
  for (let i = 0; i < itemName.length; i += 1) hash = (hash * 31 + itemName.charCodeAt(i)) >>> 0;
  return hash % 5;
}

const ACCENT_CLASSES = [
  'bg-chart-1/15 text-chart-1',
  'bg-chart-2/15 text-chart-2',
  'bg-chart-3/15 text-chart-3',
  'bg-chart-4/15 text-chart-4',
  'bg-chart-5/15 text-chart-5',
];

export function TopSellingItems() {
  const { items, isPending, isError, refetch } = useTopSellingItemsWithGrowth(8);

  return (
    <WidgetCard
      title="Top selling items"
      description="Last 30 days, by units sold"
      isLoading={isPending}
      isError={isError}
      onRetry={refetch}
      isEmpty={!isPending && (items?.length ?? 0) === 0}
      emptyIcon={UtensilsCrossed}
      emptyTitle="No sales yet"
      emptyDescription="Top items appear here once orders start coming in."
      contentHeight="h-80"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items?.map((item, index) => (
          <motion.div
            key={item.itemId}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.04 }}
            className="flex items-center gap-3 rounded-lg p-2.5 ring-1 ring-foreground/10"
          >
            <div
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-lg text-sm font-semibold',
                ACCENT_CLASSES[itemAccentIndex(item.itemName)],
              )}
              aria-hidden
            >
              {item.itemName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{item.itemName}</p>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(item.revenue)} · {formatCompactNumber(item.quantitySold)} sold
              </p>
            </div>
            {item.growthPercent === null ? (
              <Badge variant="secondary" className="shrink-0">
                <Minus className="size-3" />
                New
              </Badge>
            ) : (
              <Badge
                variant={item.growthPercent >= 0 ? 'success' : 'destructive'}
                className="shrink-0"
              >
                {item.growthPercent >= 0 ? (
                  <TrendingUp className="size-3" />
                ) : (
                  <TrendingDown className="size-3" />
                )}
                {item.growthPercent >= 0 ? '+' : ''}
                {item.growthPercent}%
              </Badge>
            )}
          </motion.div>
        ))}
      </div>
    </WidgetCard>
  );
}
