import type { Document, Types } from 'mongoose';

/**
 * Forward-only, same convention as `OrderStatus`. `CREATED` is the
 * only entry state (set the moment `POST /payments/create-order`
 * makes the Razorpay order); `FAILED`/`REFUNDED` are terminal.
 * `PENDING` exists for payment methods whose webhook flow reports an
 * intermediate "authorized but not yet captured" state before
 * settling to `SUCCESS`/`FAILED` — the synchronous `POST /payments/verify`
 * flow skips it entirely and goes `CREATED` -> `SUCCESS`/`FAILED`
 * directly, which is why `CREATED`'s own forward set (see
 * payments.constants.ts's `PAYMENT_FORWARD_TRANSITIONS`) includes all
 * three, not just `PENDING`.
 */
export const PAYMENT_STATUSES = ['CREATED', 'PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/**
 * No soft-delete, no `createdBy` — same reasoning as `IOrder`: a
 * payment record is never deleted (financial audit trail), and
 * `userId` already identifies who it belongs to.
 */
export interface IPayment extends Document {
  _id: Types.ObjectId;
  orderId: Types.ObjectId;
  userId: Types.ObjectId;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  /** Never returned to the client — see `PublicPaymentDto`'s doc comment. */
  razorpaySignature?: string;
  /** Integer, paise. Always copied from `Order.totalAmount` at creation — never accepted from a client. See docs/DATABASE_DESIGN.md §6. */
  amount: number;
  currency: string;
  status: PaymentStatus;
  /** Razorpay's own method vocabulary (`card`, `upi`, `netbanking`, `wallet`, `emi`, ...) — informational, populated from Razorpay's response when available, not validated against a closed set (Razorpay's list isn't ours to constrain). */
  paymentMethod?: string;
  /** External settlement reference (e.g. a bank RRN), when Razorpay provides one — distinct from `razorpayPaymentId`. */
  transactionId?: string;
  failureReason?: string;
  /** Integer, paise. Populated on `REFUNDED`; may be less than `amount` for a partial refund. */
  refundedAmount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicPaymentDto {
  id: string;
  orderId: string;
  userId: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod?: string;
  transactionId?: string;
  failureReason?: string;
  refundedAmount?: number;
  createdAt: Date;
  updatedAt: Date;
}

/** `razorpaySignature` is deliberately excluded — nothing legitimate a client does with it, matching the `passwordHash`-excluded-from-`PublicUserDto` convention. */
export function toPublicPaymentDto(payment: IPayment): PublicPaymentDto {
  return {
    id: payment._id.toString(),
    orderId: payment.orderId.toString(),
    userId: payment.userId.toString(),
    razorpayOrderId: payment.razorpayOrderId,
    razorpayPaymentId: payment.razorpayPaymentId,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    paymentMethod: payment.paymentMethod,
    transactionId: payment.transactionId,
    failureReason: payment.failureReason,
    refundedAmount: payment.refundedAmount,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}
