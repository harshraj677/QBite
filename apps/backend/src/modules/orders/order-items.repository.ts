import type { Types } from 'mongoose';

import { OrderItemModel } from './order-item.model';
import { OrderModel } from './order.model';
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

export interface ItemSalesStats {
  itemId: string;
  itemName: string;
  quantitySold: number;
  revenue: number;
}

export interface CategoryRevenueStats {
  categoryName: string;
  revenue: number;
  quantitySold: number;
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

  /**
   * Excludes items belonging to a `cancelled` order — a cancelled
   * order was never fulfilled, so counting its items as "sold" would
   * be misleading for Menu Analytics. `OrderItem.createdAt` isn't
   * enough on its own to know the parent order's current status, so
   * this joins back to `orders` (same module, both collections owned
   * by `modules/orders/` — not a cross-module boundary crossing) via
   * `$lookup` rather than duplicating status onto every line item.
   * `OrderModel.collection.name` (not a hardcoded `'orders'` string)
   * keeps this correct if the collection-naming convention ever
   * changes.
   *
   * Sales are only ever visible for items that were actually ordered
   * — a menu item with zero orders in range has no `OrderItem`
   * documents at all, so it can't appear in either the top- or
   * least-selling results. Flagged as a known scope limit, not a
   * silent gap: joining the full menu-items catalog to surface
   * never-ordered items was judged out of scope for this phase.
   */
  async getItemSalesAggregate(filter: { from: Date; to: Date }): Promise<ItemSalesStats[]> {
    const rows = await OrderItemModel.aggregate<{
      _id: string;
      itemName: string;
      quantitySold: number;
      revenue: number;
    }>([
      { $match: { createdAt: { $gte: filter.from, $lte: filter.to } } },
      {
        $lookup: {
          from: OrderModel.collection.name,
          localField: 'orderId',
          foreignField: '_id',
          as: 'order',
        },
      },
      { $unwind: '$order' },
      { $match: { 'order.status': { $ne: 'cancelled' } } },
      {
        $group: {
          _id: '$itemSnapshot.itemId',
          itemName: { $first: '$itemSnapshot.itemName' },
          quantitySold: { $sum: '$quantity' },
          revenue: { $sum: '$totalPrice' },
        },
      },
      { $sort: { quantitySold: -1 } },
    ]);
    return rows.map((row) => ({
      itemId: row._id,
      itemName: row.itemName,
      quantitySold: row.quantitySold,
      revenue: row.revenue,
    }));
  }

  /** Same cancelled-order exclusion as getItemSalesAggregate, grouped by `itemSnapshot.categoryName` (the frozen category label, not a live `categoryId` join — see order-item.types.ts's snapshot rationale) — Menu Analytics' "Revenue per Category". */
  async getCategoryRevenueAggregate(filter: {
    from: Date;
    to: Date;
  }): Promise<CategoryRevenueStats[]> {
    const rows = await OrderItemModel.aggregate<{
      _id: string;
      revenue: number;
      quantitySold: number;
    }>([
      { $match: { createdAt: { $gte: filter.from, $lte: filter.to } } },
      {
        $lookup: {
          from: OrderModel.collection.name,
          localField: 'orderId',
          foreignField: '_id',
          as: 'order',
        },
      },
      { $unwind: '$order' },
      { $match: { 'order.status': { $ne: 'cancelled' } } },
      {
        $group: {
          _id: '$itemSnapshot.categoryName',
          revenue: { $sum: '$totalPrice' },
          quantitySold: { $sum: '$quantity' },
        },
      },
      { $sort: { revenue: -1 } },
    ]);
    return rows.map((row) => ({
      categoryName: row._id,
      revenue: row.revenue,
      quantitySold: row.quantitySold,
    }));
  }
}
