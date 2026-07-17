import type { Document, Types } from 'mongoose';

/**
 * Order lifecycle — a strictly forward pipeline plus one terminal side
 * branch. `pending` is the only entry state; `completed`/`cancelled`
 * are the only exits, and both are immutable once reached (no field
 * on an order in either state is ever written again). Cancellation is
 * deliberately **not** reachable through the same transition map as
 * the forward pipeline — see OrdersService's two separate mutation
 * paths (`updateStatus` vs `cancelOrder`) and orders.constants.ts's
 * `FORWARD_TRANSITIONS`.
 */
export const ORDER_STATUSES = [
  'pending',
  'accepted',
  'preparing',
  'ready',
  'completed',
  'cancelled',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Deliberately independent of `OrderStatus` — no payment gateway is
 * integrated yet (Razorpay env vars exist but no `payments` module
 * has been built), so this field is write-once at order creation
 * (`pending`, or `paid` for a hypothetical already-settled method) and
 * nothing in this module ever transitions it afterward. Left as its
 * own enum, not folded into `paymentMethod`, so a future Payments
 * module has a field to write to without a schema change.
 */
export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/**
 * `cash` = paid at the pickup counter (paymentStatus stays `pending`
 * until pickup); `online` = a placeholder for the future Razorpay
 * integration. No gateway call happens in this module either way.
 */
export const PAYMENT_METHODS = ['cash', 'online'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * No soft-delete fields (`isDeleted`/`deletedBy`) and no `createdBy` —
 * deliberate, not an oversight. Orders are never deleted (`Complete
 * order lifecycle... Immutable order history` in the phase spec); the
 * placing student is already captured by `studentId`, so there's no
 * separate "who created this" actor to track the way canteens/menu
 * need `createdBy` for staff-managed catalog entities.
 */
export interface IOrder extends Document {
  _id: Types.ObjectId;
  orderNumber: string;
  canteenId: Types.ObjectId;
  studentId: Types.ObjectId;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  /** Integer, paise — sum of every OrderItem's totalPrice. See docs/DATABASE_DESIGN.md §6. */
  subtotal: number;
  /** Integer, paise. See orders.constants.ts's ORDER_TAX_RATE_PERCENT — currently 0, a placeholder pending an actual tax policy. */
  tax: number;
  /** Integer, paise. Always 0 in this phase — no coupon/discount module exists yet. */
  discount: number;
  /** Integer, paise. subtotal + tax - discount. Server-computed only; never accepted from the client. */
  totalAmount: number;
  /** Opaque 6-digit code shown by the student and checked by kitchen staff at pickup. Not a secret credential (not hashed) — same threat model as a queue-number ticket, not a password-reset token. */
  pickupToken: string;
  /** Max of the ordered items' preparationTimeMinutes — items are prepared in parallel by the kitchen, not sequentially, so a sum would overstate the wait. */
  estimatedReadyTimeMinutes: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  acceptedAt?: Date;
  preparingAt?: Date;
  readyAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
}

export interface PublicOrderDto {
  id: string;
  orderNumber: string;
  canteenId: string;
  studentId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  subtotal: number;
  tax: number;
  discount: number;
  totalAmount: number;
  pickupToken: string;
  estimatedReadyTimeMinutes: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  acceptedAt?: Date;
  preparingAt?: Date;
  readyAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
}

export function toPublicOrderDto(order: IOrder): PublicOrderDto {
  return {
    id: order._id.toString(),
    orderNumber: order.orderNumber,
    canteenId: order.canteenId.toString(),
    studentId: order.studentId.toString(),
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    subtotal: order.subtotal,
    tax: order.tax,
    discount: order.discount,
    totalAmount: order.totalAmount,
    pickupToken: order.pickupToken,
    estimatedReadyTimeMinutes: order.estimatedReadyTimeMinutes,
    notes: order.notes,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    acceptedAt: order.acceptedAt,
    preparingAt: order.preparingAt,
    readyAt: order.readyAt,
    completedAt: order.completedAt,
    cancelledAt: order.cancelledAt,
    cancellationReason: order.cancellationReason,
  };
}
