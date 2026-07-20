'use client';

import { format, formatDistanceToNow } from 'date-fns';
import {
  Ban,
  CalendarClock,
  ChefHat,
  Check,
  CreditCard,
  History,
  Mail,
  Phone,
  Receipt,
  ScrollText,
  ShieldCheck,
  Ticket,
  User,
  Users,
} from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QueryErrorState } from '@/components/shared/query-error-state';
import { LoadingButton } from '@/components/shared/loading-button';
import { formatCurrency } from '@/lib/format';
import {
  ORDER_FORWARD_TRANSITIONS,
  ORDER_STATUS_BADGE_VARIANT,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_BADGE_VARIANT,
  PAYMENT_STATUS_LABELS,
} from '@/lib/order-status';
import { useAdvanceOrderStatus } from '../hooks/use-advance-order-status';
import { useOrderDetail, useOrderPayment, useStudent } from '../hooks/use-order-detail';
import { OrderTimeline } from './order-timeline';
import { NotAvailableSection } from './not-available-section';

interface OrderDetailDrawerProps {
  orderId: string | null;
  onClose: () => void;
}

const PAYMENT_RECORD_STATUS_VARIANT = {
  CREATED: 'secondary',
  PENDING: 'secondary',
  SUCCESS: 'success',
  FAILED: 'destructive',
  REFUNDED: 'warning',
} as const;

export function OrderDetailDrawer({ orderId, onClose }: OrderDetailDrawerProps) {
  const { data: order, isPending, isError, refetch } = useOrderDetail(orderId);
  const payment = useOrderPayment(orderId);
  const student = useStudent(order?.studentId ?? null);
  const advanceStatus = useAdvanceOrderStatus();

  const nextStatuses = order ? ORDER_FORWARD_TRANSITIONS[order.status] : [];

  return (
    <Sheet open={orderId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-lg">
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle className="flex items-center gap-2">
            {order ? order.orderNumber : 'Order details'}
            {order && <Badge variant={ORDER_STATUS_BADGE_VARIANT[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Badge>}
          </SheetTitle>
          <SheetDescription>
            {order
              ? `Placed ${formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}`
              : 'Loading order…'}
          </SheetDescription>
          {order && nextStatuses.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {nextStatuses.map((status) => (
                <LoadingButton
                  key={status}
                  size="sm"
                  loading={
                    advanceStatus.isPending && advanceStatus.variables?.toStatus === status
                  }
                  onClick={() => advanceStatus.mutate({ orderId: order.id, toStatus: status })}
                >
                  <Check className="size-3.5" />
                  Mark as {ORDER_STATUS_LABELS[status]}
                </LoadingButton>
              ))}
            </div>
          )}
        </SheetHeader>

        <div className="px-6 py-4">
          {isPending ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : isError ? (
            <QueryErrorState onRetry={refetch} />
          ) : order ? (
            <Tabs defaultValue="overview">
              <TabsList className="w-full">
                <TabsTrigger value="overview" className="flex-1">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="payment" className="flex-1">
                  Payment
                </TabsTrigger>
                <TabsTrigger value="history" className="flex-1">
                  History
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6 pt-4">
                <section>
                  <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <CalendarClock className="size-4" />
                    Timeline
                  </h3>
                  <OrderTimeline order={order} />
                </section>

                <Separator />

                <section>
                  <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <ChefHat className="size-4" />
                    Kitchen
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-muted px-3 py-2">
                      <p className="text-xs text-muted-foreground">Pickup code</p>
                      <p className="font-mono font-semibold text-foreground">{order.pickupToken}</p>
                    </div>
                    <div className="rounded-lg bg-muted px-3 py-2">
                      <p className="text-xs text-muted-foreground">Est. ready time</p>
                      <p className="font-medium text-foreground">
                        {order.estimatedReadyTimeMinutes} min
                      </p>
                    </div>
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
                      <p className="flex items-center gap-1.5 font-medium text-foreground">
                        {student.data.fullName}
                        {student.data.isEmailVerified && (
                          <ShieldCheck className="size-3.5 text-success" />
                        )}
                      </p>
                      <p className="flex items-center gap-1.5 text-muted-foreground">
                        <Mail className="size-3.5" />
                        {student.data.collegeEmail}
                      </p>
                      <p className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="size-3.5" />
                        {student.data.phoneNumber}
                      </p>
                      {student.data.usn && (
                        <p className="text-xs text-muted-foreground">USN {student.data.usn}</p>
                      )}
                    </div>
                  ) : null}
                </section>

                <Separator />

                <section>
                  <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <Receipt className="size-4" />
                    Items
                  </h3>
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
                </section>

                <Separator />

                <section className="space-y-1.5 text-sm">
                  <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <Ticket className="size-4" />
                    Pricing
                  </h3>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{formatCurrency(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax</span>
                    <span className="tabular-nums">{formatCurrency(order.tax)}</span>
                  </div>
                  {order.discount > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Discount</span>
                      <span className="tabular-nums">-{formatCurrency(order.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-medium text-foreground">
                    <span>Total</span>
                    <span className="tabular-nums">{formatCurrency(order.totalAmount)}</span>
                  </div>
                </section>
              </TabsContent>

              <TabsContent value="payment" className="space-y-4 pt-4">
                <div className="flex items-center gap-2">
                  <Badge variant={PAYMENT_STATUS_BADGE_VARIANT[order.paymentStatus]}>
                    {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                  </Badge>
                  <Badge variant="outline">{order.paymentMethod === 'cash' ? 'Cash' : 'Online'}</Badge>
                </div>

                {payment.isPending ? (
                  <Skeleton className="h-40 w-full" />
                ) : payment.isNotFound ? (
                  <NotAvailableSection reason="No Razorpay payment attempt exists for this order yet (cash orders, or orders awaiting checkout, have none)." />
                ) : payment.isError ? (
                  <QueryErrorState onRetry={payment.refetch} />
                ) : payment.data ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="size-4 text-muted-foreground" />
                      <Badge variant={PAYMENT_RECORD_STATUS_VARIANT[payment.data.status]}>
                        {payment.data.status}
                      </Badge>
                      {payment.data.paymentMethod && (
                        <span className="text-xs text-muted-foreground uppercase">
                          {payment.data.paymentMethod}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5 rounded-lg bg-muted px-3 py-2.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Amount</span>
                        <span className="font-medium tabular-nums">
                          {formatCurrency(payment.data.amount)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Razorpay order</span>
                        <span className="font-mono text-xs">{payment.data.razorpayOrderId}</span>
                      </div>
                      {payment.data.razorpayPaymentId && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Razorpay payment</span>
                          <span className="font-mono text-xs">{payment.data.razorpayPaymentId}</span>
                        </div>
                      )}
                      {payment.data.transactionId && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Transaction</span>
                          <span className="font-mono text-xs">{payment.data.transactionId}</span>
                        </div>
                      )}
                      {payment.data.refundedAmount !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Refunded</span>
                          <span className="font-medium tabular-nums">
                            {formatCurrency(payment.data.refundedAmount)}
                          </span>
                        </div>
                      )}
                    </div>
                    {payment.data.failureReason && (
                      <p className="flex items-start gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        <Ban className="mt-0.5 size-3.5 shrink-0" />
                        {payment.data.failureReason}
                      </p>
                    )}
                  </div>
                ) : null}
              </TabsContent>

              <TabsContent value="history" className="space-y-6 pt-4">
                <section>
                  <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <History className="size-4" />
                    Status history
                  </h3>
                  <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
                    <table className="w-full text-sm">
                      <tbody>
                        {(
                          [
                            ['createdAt', 'Placed'],
                            ['acceptedAt', 'Accepted'],
                            ['preparingAt', 'Preparing'],
                            ['readyAt', 'Ready'],
                            ['completedAt', 'Completed'],
                            ['cancelledAt', 'Cancelled'],
                          ] as const
                        )
                          .filter(([field]) => order[field])
                          .map(([field, label]) => (
                            <tr key={field} className="border-b border-border last:border-0">
                              <td className="px-3 py-2 text-muted-foreground">{label}</td>
                              <td className="px-3 py-2 text-right font-medium text-foreground">
                                {format(new Date(order[field] as string), 'MMM d, yyyy · h:mm a')}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <Separator />

                <section>
                  <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <Users className="size-4" />
                    Notifications
                  </h3>
                  <NotAvailableSection reason="Notifications are scoped to their recipient only — the backend has no admin-facing 'notifications for this order' endpoint yet." />
                </section>

                <Separator />

                <section>
                  <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <ScrollText className="size-4" />
                    Audit history
                  </h3>
                  <NotAvailableSection reason="Audit logs are recorded server-side for every order/payment event, but have no HTTP read endpoint yet — internal-only for now." />
                </section>
              </TabsContent>
            </Tabs>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
