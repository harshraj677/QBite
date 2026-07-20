'use client';

import { format } from 'date-fns';
import {
  Ban,
  Check,
  Clock,
  History,
  Info,
  Leaf,
  Receipt,
  Ticket,
  UtensilsCrossed,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { QueryErrorState } from '@/components/shared/query-error-state';
import { LoadingButton } from '@/components/shared/loading-button';
import { NotAvailableSection } from '@/features/orders/components/not-available-section';
import { ConfirmActionDialog } from '@/features/users/components/confirm-action-dialog';
import { formatCurrency } from '@/lib/format';
import { useMenuItemDetail } from '../hooks/use-menu-item-detail';
import { useMenuItemStats } from '../hooks/use-menu-item-stats';
import { useUpdateMenuItemAvailability } from '../hooks/use-update-menu-item-availability';

interface MenuItemDetailDrawerProps {
  itemId: string | null;
  categoryName?: string;
  onClose: () => void;
}

export function MenuItemDetailDrawer({ itemId, categoryName, onClose }: MenuItemDetailDrawerProps) {
  const { data: item, isPending, isError, refetch } = useMenuItemDetail(itemId);
  const stats = useMenuItemStats(itemId);
  const updateAvailability = useUpdateMenuItemAvailability();
  const [confirmingAvailability, setConfirmingAvailability] = useState(false);

  return (
    <Sheet open={itemId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle className="flex items-center gap-2">
            {item ? item.name : 'Menu item details'}
            {item && (
              <Badge variant={item.isAvailable ? 'success' : 'destructive'}>
                {item.isAvailable ? 'Available' : 'Unavailable'}
              </Badge>
            )}
            {item?.isFeatured && <Badge variant="warning">Featured</Badge>}
          </SheetTitle>
          <SheetDescription>{categoryName ?? (item ? 'Loading category…' : 'Loading item…')}</SheetDescription>
        </SheetHeader>

        <div className="px-6 py-4">
          {isPending ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : isError ? (
            <QueryErrorState onRetry={refetch} />
          ) : item ? (
            <div className="space-y-6">
              <section>
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-40 w-full rounded-xl object-cover ring-1 ring-foreground/10"
                  />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center rounded-xl bg-muted text-muted-foreground ring-1 ring-foreground/10">
                    <UtensilsCrossed className="size-8" />
                  </div>
                )}
              </section>

              <section>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-foreground">{item.name}</p>
                    <p className="text-sm text-muted-foreground">{categoryName ?? '—'}</p>
                  </div>
                  {item.isVeg ? (
                    <Badge variant="success">
                      <Leaf className="size-3" />
                      Veg
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Non-veg</Badge>
                  )}
                </div>
              </section>

              <Separator />

              <section>
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Ticket className="size-4" />
                  Price
                </h3>
                <p className="rounded-lg bg-muted px-3 py-2.5 text-lg font-semibold tabular-nums text-foreground">
                  {formatCurrency(item.price)}
                </p>
              </section>

              <Separator />

              <section>
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  {item.isAvailable ? (
                    <Check className="size-4 text-success" />
                  ) : (
                    <Ban className="size-4 text-destructive" />
                  )}
                  Availability
                </h3>
                <div className="space-y-2">
                  <Badge variant={item.isAvailable ? 'success' : 'destructive'}>
                    {item.isAvailable ? 'Available' : 'Unavailable'}
                  </Badge>
                  <LoadingButton
                    variant={item.isAvailable ? 'destructive' : 'default'}
                    size="sm"
                    className="w-full"
                    loading={updateAvailability.isPending}
                    onClick={() => setConfirmingAvailability(true)}
                  >
                    {item.isAvailable ? <Ban className="size-3.5" /> : <Check className="size-3.5" />}
                    {item.isAvailable ? 'Mark unavailable' : 'Mark available'}
                  </LoadingButton>
                  {item.isAvailable && item.isFeatured && (
                    <p className="text-xs text-muted-foreground">
                      Marking unavailable also un-features this item — it can&apos;t remain featured
                      while unavailable.
                    </p>
                  )}
                </div>
              </section>

              <Separator />

              <section>
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Info className="size-4" />
                  Description
                </h3>
                {item.description ? (
                  <p className="rounded-lg bg-muted px-3 py-2.5 text-sm text-foreground">
                    {item.description}
                  </p>
                ) : (
                  <NotAvailableSection reason="No description was provided for this item." />
                )}
              </section>

              <Separator />

              <section>
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Receipt className="size-4" />
                  Statistics
                </h3>
                {stats.isPending ? (
                  <Skeleton className="h-20 w-full" />
                ) : stats.isError ? (
                  <NotAvailableSection reason="Couldn't load this item's sales analytics." />
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-muted px-3 py-2.5 text-sm">
                      <p className="text-xs text-muted-foreground">Units sold (last 30 days)</p>
                      <p className="text-lg font-semibold tabular-nums text-foreground">
                        {stats.quantitySold}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted px-3 py-2.5 text-sm">
                      <p className="text-xs text-muted-foreground">Revenue (last 30 days)</p>
                      <p className="text-lg font-semibold tabular-nums text-foreground">
                        {formatCurrency(stats.revenue)}
                      </p>
                    </div>
                  </div>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  No per-item order count exists on the backend — &quot;units sold&quot; (quantity,
                  not orders) is the real, available figure.
                </p>
              </section>

              <Separator />

              <section>
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Clock className="size-4" />
                  Last updated
                </h3>
                <p className="rounded-lg bg-muted px-3 py-2.5 text-sm text-foreground">
                  {format(new Date(item.updatedAt), 'MMM d, yyyy · h:mm a')}
                </p>
              </section>

              <Separator />

              <section>
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <History className="size-4" />
                  Activity
                </h3>
                <NotAvailableSection reason="Audit logs are recorded server-side for every menu item event, but have no HTTP read endpoint yet — internal-only for now." />
              </section>
            </div>
          ) : null}
        </div>
      </SheetContent>

      {item && (
        <ConfirmActionDialog
          open={confirmingAvailability}
          onOpenChange={setConfirmingAvailability}
          title={item.isAvailable ? 'Mark this item unavailable?' : 'Mark this item available?'}
          description={
            item.isAvailable
              ? `${item.name} will immediately stop appearing as orderable to students.${item.isFeatured ? ' It will also be un-featured.' : ''}`
              : `${item.name} will immediately become orderable to students.`
          }
          confirmLabel={item.isAvailable ? 'Mark unavailable' : 'Mark available'}
          destructive={item.isAvailable}
          isPending={updateAvailability.isPending}
          onConfirm={() =>
            updateAvailability.mutate(
              { itemId: item.id, isAvailable: !item.isAvailable },
              { onSettled: () => setConfirmingAvailability(false) },
            )
          }
        />
      )}
    </Sheet>
  );
}
