import type { OrderStatus, PaymentMethod, PaymentStatus } from '@/types/order';

export type {
  OrderDto,
  OrderItemDto,
  OrderItemSnapshot,
  OrderStatus,
  OrderWithItemsDto,
  PaymentMethod,
  PaymentStatus,
} from '@/types/order';

/** Mirrors apps/backend/src/modules/payments/payment.types.ts's PublicPaymentDto exactly. */
export interface PaymentDto {
  id: string;
  orderId: string;
  userId: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  amount: number;
  currency: string;
  status: 'CREATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
  paymentMethod?: string;
  transactionId?: string;
  failureReason?: string;
  refundedAmount?: number;
  createdAt: string;
  updatedAt: string;
}

/** The canonical user shape — see `@/types/auth`'s `AuthUser` doc comment for why this is a re-export, not a parallel declaration. */
export type { AuthUser as StudentDto } from '@/types/auth';

/**
 * Every filter `GET /kitchen/orders` now genuinely supports server-side
 * (see the Operations Center's backend extension — kitchen.validation.ts).
 * `dateFrom`/`dateTo` are ISO date strings (yyyy-mm-dd), not Date
 * objects, since that's what goes on the wire and what
 * `<input type="date">` naturally produces.
 */
export interface OrdersFilters {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  /** Added for the Payments Management phase — mirrors `paymentStatus` above. */
  paymentMethod?: PaymentMethod;
  orderNumber?: string;
  pickupToken?: string;
  studentId?: string;
  canteenId?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
}

export type DatePreset = 'today' | 'yesterday' | 'last7days' | 'custom' | 'all';

export interface OrdersQueryParams extends OrdersFilters {
  page: number;
  limit: number;
  sortOrder: 'asc' | 'desc';
  /** Added for the Kitchen Operations Center phase — see apps/backend's kitchen.validation.ts doc comment. Sent as the literal string `"true"`/`"false"` on the wire (see api.ts), never omitted-vs-coerced ambiguity. */
  includeItems?: boolean;
}
