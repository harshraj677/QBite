'use client';

import { format, formatDistanceToNow } from 'date-fns';
import {
  Ban,
  Calendar,
  Check,
  Mail,
  Phone,
  Receipt,
  ScrollText,
  ShieldCheck,
  ShieldX,
  UserCog,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { QueryErrorState } from '@/components/shared/query-error-state';
import { LoadingButton } from '@/components/shared/loading-button';
import { NotAvailableSection } from '@/features/orders/components/not-available-section';
import { formatCurrency, getInitials } from '@/lib/format';
import { PAYMENT_STATUS_BADGE_VARIANT, PAYMENT_STATUS_LABELS } from '@/lib/order-status';
import { USER_ROLE_LABELS } from '@/lib/user-role';
import { useAuth } from '@/providers/auth-provider';
import { USER_ROLES } from '@/types/auth';
import { useUpdateUserRole } from '../hooks/use-update-user-role';
import { useUpdateUserStatus } from '../hooks/use-update-user-status';
import { useUserDetail } from '../hooks/use-user-detail';
import { useUserOrders } from '../hooks/use-user-orders';
import { ConfirmActionDialog } from './confirm-action-dialog';
import type { UserRole } from '../types';

interface UserDetailDrawerProps {
  userId: string | null;
  onClose: () => void;
}

export function UserDetailDrawer({ userId, onClose }: UserDetailDrawerProps) {
  const { user: currentUser } = useAuth();
  const { data: user, isPending, isError, refetch } = useUserDetail(userId);
  const orders = useUserOrders(userId);
  const updateRole = useUpdateUserRole();
  const updateStatus = useUpdateUserStatus();
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const [confirmingStatus, setConfirmingStatus] = useState(false);

  const isSelf = currentUser !== null && user !== undefined && currentUser.id === user?.id;

  const orderList = orders.data?.data ?? [];
  const orderMeta = orders.data?.meta;
  const isPartialSample = orderMeta !== undefined && orderMeta.total > orderList.length;
  const paidOrders = orderList.filter((o) => o.paymentStatus === 'paid');
  const totalPaid = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const paymentBreakdown = (['paid', 'pending', 'failed', 'refunded'] as const).map((status) => ({
    status,
    count: orderList.filter((o) => o.paymentStatus === status).length,
  }));

  return (
    <Sheet open={userId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle className="flex items-center gap-2">
            {user ? user.fullName : 'User details'}
            {user && (
              <Badge variant={user.isActive ? 'success' : 'destructive'}>
                {user.isActive ? 'Active' : 'Deactivated'}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            {user
              ? `Joined ${formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}`
              : 'Loading user…'}
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
          ) : user ? (
            <div className="space-y-6">
              <section>
                <div className="flex items-center gap-3">
                  <Avatar size="lg">
                    <AvatarFallback>{getInitials(user.fullName)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-foreground">{user.fullName}</p>
                    {user.usn && <p className="text-xs text-muted-foreground">USN {user.usn}</p>}
                  </div>
                </div>
              </section>

              <Separator />

              <section>
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Mail className="size-4" />
                  Contact
                </h3>
                <div className="space-y-1.5 rounded-lg bg-muted px-3 py-2.5 text-sm">
                  <p className="flex items-center gap-1.5 text-foreground">
                    <Mail className="size-3.5 text-muted-foreground" />
                    {user.collegeEmail}
                  </p>
                  <p className="flex items-center gap-1.5 text-foreground">
                    <Phone className="size-3.5 text-muted-foreground" />
                    {user.phoneNumber}
                  </p>
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="size-3.5" />
                    Joined {format(new Date(user.createdAt), 'MMM d, yyyy')}
                  </p>
                </div>
              </section>

              <Separator />

              <section>
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <UserCog className="size-4" />
                  Role management
                </h3>
                <div className="space-y-2">
                  <Select
                    value={user.role}
                    disabled={isSelf}
                    onValueChange={(v) => setPendingRole(v as UserRole)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {USER_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {USER_ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isSelf && (
                    <p className="text-xs text-muted-foreground">
                      You can&apos;t change your own role or status.
                    </p>
                  )}
                  <LoadingButton
                    variant={user.isActive ? 'destructive' : 'default'}
                    size="sm"
                    className="w-full"
                    disabled={isSelf}
                    loading={updateStatus.isPending}
                    onClick={() => setConfirmingStatus(true)}
                  >
                    {user.isActive ? <Ban className="size-3.5" /> : <Check className="size-3.5" />}
                    {user.isActive ? 'Deactivate account' : 'Activate account'}
                  </LoadingButton>
                </div>
              </section>

              <Separator />

              <section>
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  {user.isEmailVerified ? (
                    <ShieldCheck className="size-4 text-success" />
                  ) : (
                    <ShieldX className="size-4 text-muted-foreground" />
                  )}
                  Verification
                </h3>
                <Badge variant={user.isEmailVerified ? 'success' : 'secondary'}>
                  {user.isEmailVerified ? 'Email verified' : 'Email not verified'}
                </Badge>
              </section>

              <Separator />

              <section>
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Receipt className="size-4" />
                  Order summary
                </h3>
                {orders.isPending ? (
                  <Skeleton className="h-20 w-full" />
                ) : orders.isError ? (
                  <NotAvailableSection reason="Couldn't load this user's orders." />
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-lg bg-muted px-3 py-2.5 text-sm">
                      <p className="text-xs text-muted-foreground">Total orders</p>
                      <p className="text-lg font-semibold tabular-nums text-foreground">
                        {orderMeta?.total ?? 0}
                      </p>
                    </div>
                    {orderList.length > 0 ? (
                      <ul className="space-y-1.5">
                        {orderList.slice(0, 5).map((order) => (
                          <li
                            key={order.id}
                            className="flex items-center justify-between text-sm text-muted-foreground"
                          >
                            <span className="font-medium text-foreground">{order.orderNumber}</span>
                            <span className="tabular-nums">{formatCurrency(order.totalAmount)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">No orders yet.</p>
                    )}
                  </div>
                )}
              </section>

              <Separator />

              <section>
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Wallet className="size-4" />
                  Payment summary
                </h3>
                {orders.isPending ? (
                  <Skeleton className="h-20 w-full" />
                ) : orders.isError ? (
                  <NotAvailableSection reason="Couldn't load this user's payment history." />
                ) : orderList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payment activity yet.</p>
                ) : (
                  <div className="space-y-2">
                    <div className="rounded-lg bg-muted px-3 py-2.5 text-sm">
                      <p className="text-xs text-muted-foreground">Total paid</p>
                      <p className="text-lg font-semibold tabular-nums text-foreground">
                        {formatCurrency(totalPaid)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {paymentBreakdown
                        .filter((entry) => entry.count > 0)
                        .map((entry) => (
                          <Badge key={entry.status} variant={PAYMENT_STATUS_BADGE_VARIANT[entry.status]}>
                            {entry.count} {PAYMENT_STATUS_LABELS[entry.status]}
                          </Badge>
                        ))}
                    </div>
                    {isPartialSample && (
                      <p className="text-xs text-muted-foreground">
                        Based on the {orderList.length} most recent orders, not all {orderMeta?.total}.
                      </p>
                    )}
                  </div>
                )}
              </section>

              <Separator />

              <section>
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <ScrollText className="size-4" />
                  Activity
                </h3>
                <NotAvailableSection reason="Audit logs are recorded server-side for every account event, but have no HTTP read endpoint yet — internal-only for now." />
              </section>
            </div>
          ) : null}
        </div>
      </SheetContent>

      {user && (
        <>
          <ConfirmActionDialog
            open={pendingRole !== null}
            onOpenChange={(open) => !open && setPendingRole(null)}
            title={`Change role to ${pendingRole ? USER_ROLE_LABELS[pendingRole] : ''}?`}
            description={`${user.fullName} will immediately gain or lose access based on the new role.`}
            confirmLabel="Change role"
            isPending={updateRole.isPending}
            onConfirm={() => {
              if (!pendingRole) return;
              updateRole.mutate(
                { userId: user.id, role: pendingRole },
                { onSuccess: () => setPendingRole(null), onError: () => setPendingRole(null) },
              );
            }}
          />
          <ConfirmActionDialog
            open={confirmingStatus}
            onOpenChange={setConfirmingStatus}
            title={user.isActive ? 'Deactivate this account?' : 'Activate this account?'}
            description={
              user.isActive
                ? `${user.fullName} will be signed out and unable to log in until reactivated.`
                : `${user.fullName} will be able to log in again immediately.`
            }
            confirmLabel={user.isActive ? 'Deactivate' : 'Activate'}
            destructive={user.isActive}
            isPending={updateStatus.isPending}
            onConfirm={() =>
              updateStatus.mutate(
                { userId: user.id, isActive: !user.isActive },
                { onSuccess: () => setConfirmingStatus(false), onError: () => setConfirmingStatus(false) },
              )
            }
          />
        </>
      )}
    </Sheet>
  );
}
