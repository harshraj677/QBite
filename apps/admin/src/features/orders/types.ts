import type { OrderStatus, PaymentStatus } from '@/types/order';

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

/** Mirrors apps/backend/src/modules/users/user.types.ts's PublicUserDto exactly. */
export interface StudentDto {
  id: string;
  usn?: string;
  fullName: string;
  collegeEmail: string;
  phoneNumber: string;
  role: 'student' | 'kitchen_staff' | 'admin' | 'super_admin';
  isEmailVerified: boolean;
  createdAt: string;
}

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
}
