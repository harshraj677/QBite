import type { Types } from 'mongoose';

import { PaymentModel } from './payment.model';
import type { IPayment, PaymentStatus } from './payment.types';

export interface CreatePaymentInput {
  orderId: string | Types.ObjectId;
  userId: string | Types.ObjectId;
  razorpayOrderId: string;
  amount: number;
  currency: string;
}

/**
 * All Mongoose queries for the `payments` collection live here — per
 * ARCHITECTURE.md §3.1's layering rule, nothing outside this file
 * (including PaymentsService) touches `PaymentModel` directly.
 *
 * No `isDeleted` filtering — like `orders`, payment records are never
 * deleted (financial audit trail).
 */
export class PaymentsRepository {
  create(input: CreatePaymentInput): Promise<IPayment> {
    return PaymentModel.create(input);
  }

  findById(id: string | Types.ObjectId): Promise<IPayment | null> {
    return PaymentModel.findOne({ _id: id }).exec();
  }

  /** Every payment attempt for an order (a student may retry after a FAILED one), most recent first. */
  findByOrderId(orderId: string | Types.ObjectId): Promise<IPayment[]> {
    return PaymentModel.find({ orderId }).sort({ createdAt: -1 }).exec();
  }

  /**
   * The single payment record `GET /payments/order/:orderId` returns:
   * the successful one if the order has been paid, otherwise the most
   * recent attempt (so a client can see why the latest try failed, or
   * that one is still `CREATED`/`PENDING`). Never returns more than
   * one document — this method exists specifically because
   * `findByOrderId`'s full list isn't what that endpoint needs.
   */
  async findRelevantByOrderId(orderId: string | Types.ObjectId): Promise<IPayment | null> {
    const success = await PaymentModel.findOne({ orderId, status: 'SUCCESS' }).exec();
    if (success) return success;
    return PaymentModel.findOne({ orderId }).sort({ createdAt: -1 }).exec();
  }

  /** Correlates a `POST /payments/verify` call or a `payment.captured`/`payment.failed` webhook (both carry Razorpay's order id) back to our Payment document. */
  findByRazorpayOrderId(razorpayOrderId: string): Promise<IPayment | null> {
    return PaymentModel.findOne({ razorpayOrderId }).exec();
  }

  /** Correlates a `refund.processed` webhook (which carries Razorpay's payment id, not the order id) back to our Payment document. */
  findByRazorpayPaymentId(razorpayPaymentId: string): Promise<IPayment | null> {
    return PaymentModel.findOne({ razorpayPaymentId }).exec();
  }

  /** Service-layer pre-check for "each order can have only one successful payment" — the real guarantee is the model's partial unique index; this is the fast-path/better-error-message optimization, same pattern as CanteensRepository.findByNameKey. */
  async existsSuccessForOrder(orderId: string | Types.ObjectId): Promise<boolean> {
    return (await PaymentModel.exists({ orderId, status: 'SUCCESS' })) !== null;
  }

  /**
   * Atomic: the filter requires the payment to currently be in
   * `fromStatus` — a concurrent second request (e.g. a webhook and a
   * `/verify` call racing for the same payment) racing past the
   * service's own pre-check gets `null` back instead of silently
   * double-applying a transition. Same pattern as
   * `OrdersRepository.updateStatus`.
   */
  updateStatus(
    id: string | Types.ObjectId,
    fromStatus: PaymentStatus,
    toStatus: PaymentStatus,
    extraFields: Record<string, unknown> = {},
  ): Promise<IPayment | null> {
    return PaymentModel.findOneAndUpdate(
      { _id: id, status: fromStatus },
      { $set: { status: toStatus, ...extraFields } },
      { returnDocument: 'after' },
    ).exec();
  }
}
