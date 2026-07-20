'use client';

import { format } from 'date-fns';
import {
  Ban,
  Check,
  Clock,
  Info,
  Mail,
  MapPin,
  Phone,
  Receipt,
  ScrollText,
  Star,
  Store,
  UserCog,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { useCanteenDetail } from '../hooks/use-canteen-detail';
import { useCanteenStats } from '../hooks/use-canteen-stats';
import { useToggleCanteenStatus } from '../hooks/use-toggle-canteen-status';

interface CanteenDetailDrawerProps {
  canteenId: string | null;
  onClose: () => void;
}

export function CanteenDetailDrawer({ canteenId, onClose }: CanteenDetailDrawerProps) {
  const { data: canteen, isPending, isError, refetch } = useCanteenDetail(canteenId);
  const stats = useCanteenStats(canteenId);
  const toggleStatus = useToggleCanteenStatus();
  const [confirmingStatus, setConfirmingStatus] = useState(false);

  return (
    <Sheet open={canteenId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle className="flex items-center gap-2">
            {canteen ? canteen.name : 'Canteen details'}
            {canteen && (
              <Badge variant={canteen.isOpen ? 'success' : 'destructive'}>
                {canteen.isOpen ? 'Open' : 'Closed'}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            {canteen ? canteen.location : 'Loading canteen…'}
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 py-4">
          {isPending ? (
            <div className="space-y-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : isError ? (
            <QueryErrorState onRetry={refetch} />
          ) : canteen ? (
            <div className="space-y-6">
              <section>
                <div className="flex items-center gap-3">
                  <Avatar size="lg">
                    <AvatarImage src={canteen.image} alt="" />
                    <AvatarFallback>
                      <Store className="size-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-foreground">{canteen.name}</p>
                    {canteen.description && (
                      <p className="text-xs text-muted-foreground">{canteen.description}</p>
                    )}
                  </div>
                </div>
              </section>

              <Separator />

              <section>
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Info className="size-4" />
                  Basic information
                </h3>
                <div className="space-y-1.5 rounded-lg bg-muted px-3 py-2.5 text-sm">
                  <p className="flex items-center gap-1.5 text-foreground">
                    <MapPin className="size-3.5 text-muted-foreground" />
                    {canteen.location}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Added {format(new Date(canteen.createdAt), 'MMM d, yyyy')}
                  </p>
                </div>
              </section>

              <Separator />

              <section>
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Mail className="size-4" />
                  Contact details
                </h3>
                <div className="space-y-1.5 rounded-lg bg-muted px-3 py-2.5 text-sm">
                  <p className="flex items-center gap-1.5 text-foreground">
                    <Mail className="size-3.5 text-muted-foreground" />
                    {canteen.email}
                  </p>
                  <p className="flex items-center gap-1.5 text-foreground">
                    <Phone className="size-3.5 text-muted-foreground" />
                    {canteen.contactNumber}
                  </p>
                </div>
              </section>

              <Separator />

              <section>
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Clock className="size-4" />
                  Operating hours
                </h3>
                <p className="rounded-lg bg-muted px-3 py-2.5 text-sm tabular-nums text-foreground">
                  {canteen.openingTime} – {canteen.closingTime}
                </p>
              </section>

              <Separator />

              <section>
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  {canteen.isOpen ? (
                    <Check className="size-4 text-success" />
                  ) : (
                    <Ban className="size-4 text-destructive" />
                  )}
                  Current status
                </h3>
                <div className="space-y-2">
                  <Badge variant={canteen.isOpen ? 'success' : 'destructive'}>
                    {canteen.isOpen ? 'Open' : 'Closed'}
                  </Badge>
                  <LoadingButton
                    variant={canteen.isOpen ? 'destructive' : 'default'}
                    size="sm"
                    className="w-full"
                    loading={toggleStatus.isPending}
                    onClick={() => setConfirmingStatus(true)}
                  >
                    {canteen.isOpen ? <Ban className="size-3.5" /> : <Check className="size-3.5" />}
                    {canteen.isOpen ? 'Close canteen' : 'Open canteen'}
                  </LoadingButton>
                  <p className="text-xs text-muted-foreground">
                    Only Open/Closed are modeled by the backend today — there is no separate
                    &quot;temporarily closed&quot; state.
                  </p>
                </div>
              </section>

              <Separator />

              <section>
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <UserCog className="size-4" />
                  Manager information
                </h3>
                <NotAvailableSection reason="No manager/owner concept exists on a canteen record yet — only who created it, which isn't necessarily who operates it." />
              </section>

              <Separator />

              <section>
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Receipt className="size-4" />
                  Statistics
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-muted px-3 py-2.5 text-sm">
                    <p className="text-xs text-muted-foreground">Total orders</p>
                    {stats.isOrdersPending ? (
                      <Skeleton className="mt-1 h-6 w-12" />
                    ) : stats.isOrdersError ? (
                      <p className="text-xs text-destructive">Unavailable</p>
                    ) : (
                      <p className="text-lg font-semibold tabular-nums text-foreground">
                        {stats.totalOrders ?? 0}
                      </p>
                    )}
                  </div>
                  <div className="rounded-lg bg-muted px-3 py-2.5 text-sm">
                    <p className="text-xs text-muted-foreground">Revenue (last 30 days)</p>
                    {stats.isRevenuePending ? (
                      <Skeleton className="mt-1 h-6 w-16" />
                    ) : stats.isRevenueError ? (
                      <p className="text-xs text-destructive">Unavailable</p>
                    ) : (
                      <p className="flex items-center gap-1 text-lg font-semibold tabular-nums text-foreground">
                        <Wallet className="size-3.5 text-muted-foreground" />
                        {formatCurrency(stats.revenue)}
                      </p>
                    )}
                  </div>
                  <div className="rounded-lg bg-muted px-3 py-2.5 text-sm">
                    <p className="text-xs text-muted-foreground">Active menu items</p>
                    {stats.isMenuCountPending ? (
                      <Skeleton className="mt-1 h-6 w-10" />
                    ) : stats.isMenuCountError ? (
                      <p className="text-xs text-destructive">Unavailable</p>
                    ) : (
                      <p className="flex items-center gap-1 text-lg font-semibold tabular-nums text-foreground">
                        <UtensilsCrossed className="size-3.5 text-muted-foreground" />
                        {stats.activeMenuItemCount ?? 0}
                      </p>
                    )}
                  </div>
                  <div className="rounded-lg bg-muted px-3 py-2.5 text-sm">
                    <p className="text-xs text-muted-foreground">Average rating</p>
                    <p className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Star className="size-3.5" />
                      Not available
                    </p>
                  </div>
                </div>
              </section>

              <Separator />

              <section>
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <ScrollText className="size-4" />
                  Recent activity
                </h3>
                <NotAvailableSection reason="Audit logs are recorded server-side for every canteen event, but have no HTTP read endpoint yet — internal-only for now." />
              </section>
            </div>
          ) : null}
        </div>
      </SheetContent>

      {canteen && (
        <ConfirmActionDialog
          open={confirmingStatus}
          onOpenChange={setConfirmingStatus}
          title={canteen.isOpen ? 'Close this canteen?' : 'Open this canteen?'}
          description={
            canteen.isOpen
              ? `${canteen.name} will stop accepting new orders immediately.`
              : `${canteen.name} will start accepting orders immediately.`
          }
          confirmLabel={canteen.isOpen ? 'Close' : 'Open'}
          destructive={canteen.isOpen}
          isPending={toggleStatus.isPending}
          onConfirm={() =>
            toggleStatus.mutate(canteen.id, { onSettled: () => setConfirmingStatus(false) })
          }
        />
      )}
    </Sheet>
  );
}
