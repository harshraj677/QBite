import type { Document, Types } from 'mongoose';

/**
 * Frozen at order-creation time, never re-read from `menu_items`
 * afterward — the single most important modeling decision for this
 * collection (same rationale docs/DATABASE_DESIGN.md §3.3 already
 * documents for the old marketplace sketch's `orders.items[]`, now
 * actually implemented here). If a canteen renames or reprices a menu
 * item tomorrow, every past order must still show what the student
 * actually saw and paid for.
 */
export interface OrderItemSnapshot {
  itemId: string;
  itemName: string;
  categoryName: string;
  image?: string;
  /** Integer, paise, at order time. */
  unitPrice: number;
  isVeg: boolean;
}

/**
 * `unitPrice`/`totalPrice` here are query/aggregation-friendly copies
 * of the same frozen values inside `itemSnapshot` — both are written
 * once, together, at creation, and never diverge. No soft-delete
 * fields: an OrderItem's lifecycle is entirely owned by its parent
 * Order (immutable once the order is completed/cancelled), not
 * independently deletable.
 */
export interface IOrderItem extends Document {
  _id: Types.ObjectId;
  orderId: Types.ObjectId;
  menuItemId: Types.ObjectId;
  quantity: number;
  /** Integer, paise. */
  unitPrice: number;
  /** Integer, paise. unitPrice * quantity. */
  totalPrice: number;
  notes?: string;
  itemSnapshot: OrderItemSnapshot;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicOrderItemDto {
  id: string;
  orderId: string;
  menuItemId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
  itemSnapshot: OrderItemSnapshot;
}

export function toPublicOrderItemDto(item: IOrderItem): PublicOrderItemDto {
  return {
    id: item._id.toString(),
    orderId: item.orderId.toString(),
    menuItemId: item.menuItemId.toString(),
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice,
    notes: item.notes,
    itemSnapshot: item.itemSnapshot,
  };
}
