import type { Types } from 'mongoose';

import { OrderItemModel } from './order-item.model';
import type { IOrderItem, OrderItemSnapshot } from './order-item.types';

export interface CreateOrderItemInput {
  orderId: Types.ObjectId;
  /** Types.ObjectId only (not `string | ObjectId` like most repository inputs) — insertMany's return-type inference otherwise widens IOrderItem[]'s menuItemId to `string | ObjectId`. */
  menuItemId: Types.ObjectId;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
  itemSnapshot: OrderItemSnapshot;
}

/**
 * All Mongoose queries for the `order_items` collection live here —
 * per ARCHITECTURE.md §3.1's layering rule, nothing outside this file
 * (including OrdersService) touches `OrderItemModel` directly.
 */
export class OrderItemsRepository {
  /** Bulk insert — an order's line items are always created together, at order-placement time, never one at a time. */
  createMany(inputs: CreateOrderItemInput[]): Promise<IOrderItem[]> {
    return OrderItemModel.insertMany(inputs);
  }

  findByOrderId(orderId: string | Types.ObjectId): Promise<IOrderItem[]> {
    return OrderItemModel.find({ orderId }).exec();
  }
}
