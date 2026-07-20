import { model, Schema } from 'mongoose';

import type { IOrder } from './order.types';
import { ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES } from './order.types';

/**
 * See docs/DATABASE_DESIGN.md §2.17 for field-by-field rationale.
 * Structural validation only — format/business rules live in
 * orders.validation.ts (Zod) and orders.service.ts, per
 * CODING_STANDARDS.md's "validate at boundaries, trust internally."
 */
const orderSchema = new Schema<IOrder>(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },
    canteenId: {
      type: Schema.Types.ObjectId,
      ref: 'Canteen',
      required: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ORDER_STATUSES,
      required: true,
      default: 'pending',
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      required: true,
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      required: true,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    tax: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      required: true,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    pickupToken: {
      type: String,
      required: true,
      unique: true,
    },
    estimatedReadyTimeMinutes: {
      type: Number,
      required: true,
      min: 1,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    acceptedAt: { type: Date },
    preparingAt: { type: Date },
    readyAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 300,
    },
  },
  { timestamps: true },
);

// A student's own order history, most recent first — GET /students/me/orders.
orderSchema.index({ studentId: 1, createdAt: -1 });
// A canteen's orders filtered by status (the kitchen queue view) — GET /canteens/:canteenId/orders.
orderSchema.index({ canteenId: 1, status: 1, createdAt: -1 });
// Analytics phase — revenue queries always $match `{paymentStatus: 'paid', createdAt: {...}}` (getRevenueSummary/getRevenueTimeSeries/getRevenueByCanteen); neither index above has paymentStatus as a leading key, so without this one those aggregations would collection-scan.
orderSchema.index({ paymentStatus: 1, createdAt: -1 });
// Analytics phase — every date-range-only aggregation with no other equality filter (getStatusCounts, getOrdersByDay/Month, getPeakOrderingHours, getAveragePreparationTimeMinutes, getCustomerOrderStats) needs createdAt as a leading key on its own; the compound indexes above only help when studentId/canteenId is also filtered.
orderSchema.index({ createdAt: -1 });

export const OrderModel = model<IOrder>('Order', orderSchema);
