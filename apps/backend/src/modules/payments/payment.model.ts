import { model, Schema } from 'mongoose';

import type { IPayment } from './payment.types';
import { PAYMENT_STATUSES } from './payment.types';

/** See docs/DATABASE_DESIGN.md §2.20 for field-by-field rationale. */
const paymentSchema = new Schema<IPayment>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    razorpayOrderId: {
      type: String,
      required: true,
    },
    razorpayPaymentId: {
      type: String,
    },
    razorpaySignature: {
      type: String,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    currency: {
      type: String,
      required: true,
      default: 'INR',
    },
    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      required: true,
      default: 'CREATED',
    },
    paymentMethod: {
      type: String,
    },
    transactionId: {
      type: String,
    },
    failureReason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    refundedAmount: {
      type: Number,
      min: 0,
    },
  },
  { timestamps: true },
);

// A given Razorpay order/payment id is only ever looked up by exact
// value (webhook correlation, /verify correlation) — plain indexes,
// not unique: a student can retry payment after a FAILED attempt,
// producing multiple Payment documents for the same orderId, each
// with its own distinct razorpayOrderId (a fresh Razorpay order is
// created per attempt), so no uniqueness constraint belongs on either
// of those fields alone.
paymentSchema.index({ razorpayOrderId: 1 });
paymentSchema.index({ razorpayPaymentId: 1 });
// A student's/kitchen's/admin's payment history for one order — GET /payments/order/:orderId.
paymentSchema.index({ orderId: 1, createdAt: -1 });

// "Each order can have only one successful payment" — enforced at the
// database level via a partial unique index (only documents actually
// matching status: 'SUCCESS' participate), not just the service-layer
// pre-check in PaymentsService.createPaymentOrder. Same
// belt-and-suspenders pattern as canteens'/menu's nameKey uniqueness:
// the index is the real guarantee, the pre-check is the fast-path/
// better-error-message optimization.
paymentSchema.index(
  { orderId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'SUCCESS' } },
);

export const PaymentModel = model<IPayment>('Payment', paymentSchema);
