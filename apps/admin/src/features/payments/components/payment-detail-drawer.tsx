'use client';

import { format } from 'date-fns';
import {
  Ban,
  CreditCard,
  Hash,
  Mail,
  Phone,
  Receipt,
  ShieldCheck,
  ShieldX,
  Ticket,
  Undo2,
  User,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { QueryErrorState } from '@/components/shared/query-error-state';
import { useOrderDetail, useOrderPayment, useStudent } from '@/features/orders/hooks/use-order-detail';
import { NotAvailableSection } from '@/features/orders/components/not-available-section';
import { formatCurrency } from '@/lib/format';
import { ORDER_STATUS_BADGE_VARIANT, PAYMENT_STATUS_LABELS } from '@/lib/order-status';

const PAYMENT_RECORD_STATUS_VARIANT = {
  CREATED: 'secondary',
  PENDING: 'secondary',
  SUCCESS: 'success',
  FAILED: 'destructive',
  REFUNDED: 'warning',
} as const;

/** SUCCESS/REFUNDED both mean "Razorpay's HMAC signature check passed" — the underlying, real meaning of `payment.status` reaching either of those two values. Presented as its own labeled concept ("Verification Status") since the spec asks for one, without inventing a second stored field to back it — it's a derived reading of the one real status field. */
function verificationLabel(status: string): { label: string; variant: 'success' | 'secondary' | 'destructive' } {
  if (status === 'SUCCESS' || status === 'REFUNDED') return { label: 'Verified', variant: 'success' };
  if (status === 'FAILED') return { label: 'Verification failed', variant: 'destructive' };
  return { label: 'Not yet verified', variant: 'secondary' };
}

interface PaymentDetailDrawerProps {
  orderId: string | null;
  onClose: () => void;
}

/** Reuses `useOrderDetail`/`useOrderPayment`/`useStudent` directly from the Operations Center's own drawer hooks — no new data-fetching logic, only a payment-focused presentation of the same real endpoints. */
export function PaymentDetailDrawer({ orderId, onClose }: PaymentDetailDrawerProps) {
  const order = useOrderDetail(orderId);
  const payment = useOrderPayment(orderId);
  const student = useStudent(order.data?.studentId ?? null);

  return (
    <Sheet open={orderId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle className="flex items-center gap-2">
            {order.data ? order.data.orderNumber : 'Payment details'}
            {order.data && (
              <Badge variant={ORDER_STATUS_BADGE_VARIANT[order.data.status]}>
                {PAYMENT_STATUS_LABELS[order.data.paymentStatus]}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            {order.data
              ? `Placed ${format(new Date(order.data.createdAt), 'MMM d, yyyy · h:mm a')}`
              : 'Loading…'}
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 py-4">
          {order.isPending ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : order.isError ? (
            <QueryErrorState onRetry={order.refetch} />
          ) : order.data ? (
            <div className="space-y-6">
              <section>
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Ticket className="size-4" />
                  Order
                </h3>
                <div className="space-y-1.5 rounded-lg bg-muted px-3 py-2.5 text-sm">
                  <p className="font-medium text-foreground">{order.data.orderNumber}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    Pickup code {order.data.pickupToken}
                  </p>
                </div>
              </section>

              <Separator />

              <section>
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <User className="size-4" />
                  Student
                </h3>
                {student.isPending ? (
                  <Skeleton className="h-16 w-full" />
                ) : student.isError ? (
                  <NotAvailableSection reason="Couldn't load the student's profile." />
                ) : student.data ? (
                  <div className="space-y-1.5 rounded-lg bg-muted px-3 py-2.5 text-sm">
                    <p className="font-medium text-foreground">{student.data.fullName}</p>
                    <p className="flex items-center gap-1.5 text-muted-foreground">
                      <Mail className="size-3.5" />
                      {student.data.collegeEmail}
                    </p>
                    <p className="flex items-center gap-1.5 text-muted-foreground">
                      <Phone className="size-3.5" />
                      {student.data.phoneNumber}
                    </p>
                  </div>
                ) : null}
              </section>

              <Separator />

              <section>
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Receipt className="size-4" />
                  Amount
                </h3>
                <p className="rounded-lg bg-muted px-3 py-2.5 text-lg font-semibold tabular-nums text-foreground">
                  {formatCurrency(payment.data?.amount ?? order.data.totalAmount)}
                </p>
              </section>

              <Separator />

              <section>
                <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Wallet className="size-4" />
                  Payment method
                </h3>
                <Badge variant="outline">
                  <CreditCard className="size-3.5" />
                  {(payment.data?.paymentMethod ?? order.data.paymentMethod) === 'online'
                    ? 'Online'
                    : 'Cash'}
                </Badge>
              </section>

              <Separator />

              {payment.isPending ? (
                <Skeleton className="h-40 w-full" />
              ) : payment.isNotFound ? (
                <section>
                  <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <Hash className="size-4" />
                    Transaction
                  </h3>
                  <NotAvailableSection reason="No Razorpay payment attempt exists for this order yet (cash orders, or orders awaiting checkout, have none)." />
                </section>
              ) : payment.isError ? (
                <QueryErrorState onRetry={payment.refetch} />
              ) : payment.data ? (
                <>
                  <section>
                    <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <Hash className="size-4" />
                      Transaction ID
                    </h3>
                    {payment.data.transactionId ? (
                      <p className="rounded-lg bg-muted px-3 py-2.5 font-mono text-sm text-foreground">
                        {payment.data.transactionId}
                      </p>
                    ) : (
                      <NotAvailableSection reason="Razorpay has not returned an external settlement reference for this payment." />
                    )}
                  </section>

                  <Separator />

                  <section>
                    <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      Payment status
                    </h3>
                    <Badge variant={PAYMENT_RECORD_STATUS_VARIANT[payment.data.status]}>
                      {payment.data.status}
                    </Badge>
                  </section>

                  <Separator />

                  <section>
                    <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      {verificationLabel(payment.data.status).variant === 'success' ? (
                        <ShieldCheck className="size-4 text-success" />
                      ) : (
                        <ShieldX className="size-4 text-muted-foreground" />
                      )}
                      Verification status
                    </h3>
                    <Badge variant={verificationLabel(payment.data.status).variant}>
                      {verificationLabel(payment.data.status).label}
                    </Badge>
                  </section>

                  <Separator />

                  <section>
                    <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <Ban className="size-4" />
                      Failure reason
                    </h3>
                    {payment.data.failureReason ? (
                      <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                        {payment.data.failureReason}
                      </p>
                    ) : (
                      <NotAvailableSection reason="This payment has not failed — no failure reason applies." />
                    )}
                  </section>

                  <Separator />

                  <section>
                    <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <Undo2 className="size-4" />
                      Refund status
                    </h3>
                    {payment.data.status === 'REFUNDED' ? (
                      <div className="rounded-lg bg-warning/10 px-3 py-2.5 text-sm">
                        <p className="font-medium text-foreground">Refunded</p>
                        <p className="tabular-nums text-muted-foreground">
                          {formatCurrency(payment.data.refundedAmount ?? 0)}
                          {(payment.data.refundedAmount ?? 0) < payment.data.amount && ' (partial)'}
                        </p>
                      </div>
                    ) : (
                      <NotAvailableSection reason="This payment has not been refunded." />
                    )}
                  </section>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
