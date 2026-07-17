import { model, Schema } from 'mongoose';

import type { IOrderItem } from './order-item.types';

const orderItemSnapshotSchema = new Schema(
  {
    itemId: { type: String, required: true },
    itemName: { type: String, required: true },
    categoryName: { type: String, required: true },
    image: { type: String },
    unitPrice: { type: Number, required: true, min: 0 },
    isVeg: { type: Boolean, required: true },
  },
  { _id: false },
);

/** See docs/DATABASE_DESIGN.md §2.18 for field-by-field rationale. */
const orderItemSchema = new Schema<IOrderItem>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    menuItemId: {
      type: Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    itemSnapshot: {
      type: orderItemSnapshotSchema,
      required: true,
    },
  },
  { timestamps: true },
);

// The only query pattern this collection serves: "every line item for order X".
orderItemSchema.index({ orderId: 1 });

export const OrderItemModel = model<IOrderItem>('OrderItem', orderItemSchema);
