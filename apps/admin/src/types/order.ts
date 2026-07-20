/**
 * Mirrors apps/backend/src/modules/orders/order.types.ts exactly.
 * Shared app-wide (not feature-local) because both `features/dashboard`
 * (Recent Orders/Live Activity, via `GET /kitchen/orders`) and
 * `features/orders` (the Operations Center) render the same real
 * `Order` entity — extracted here during the Operations Center phase
 * specifically so the two features import one definition instead of
 * two copies silently drifting apart. `features/dashboard/types.ts`
 * re-exports these under their original names so nothing there had to
 * change.
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

export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ['cash', 'online'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface OrderDto {
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
  createdAt: string;
  updatedAt: string;
  acceptedAt?: string;
  preparingAt?: string;
  readyAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
}

export interface OrderItemSnapshot {
  itemId: string;
  itemName: string;
  categoryName: string;
  image?: string;
  unitPrice: number;
  isVeg: boolean;
}

export interface OrderItemDto {
  id: string;
  orderId: string;
  menuItemId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
  itemSnapshot: OrderItemSnapshot;
}

export interface OrderWithItemsDto extends OrderDto {
  items: OrderItemDto[];
}
