import type { OrderStatus } from '@modules/orders/order.types';
import type { DateRangeFilterName, RevenueGranularityName } from './analytics.constants';

/**
 * Every non-dashboard response echoes back the resolved window it was
 * computed over (`filter`, `from`, `to` — ISO 8601 strings) so a
 * client never has to re-derive "today"/"last7days"/etc. itself to
 * know exactly what the numbers cover.
 */
interface AnalyticsRangeEnvelope {
  filter: DateRangeFilterName;
  from: string;
  to: string;
}

export interface DashboardOverviewDto {
  revenue: {
    /** All-time — every order ever marked `paid`. */
    total: number;
    today: number;
    /** Last 7 days, inclusive of today. */
    weekly: number;
    /** Month-to-date. */
    monthly: number;
  };
  orders: {
    /** Sum of every value in `byStatus` — all-time. */
    total: number;
    byStatus: Record<OrderStatus, number>;
  };
  users: {
    totalStudents: number;
    /** kitchen_staff + admin + super_admin — see AnalyticsService's doc comment on this grouping. */
    totalStaff: number;
  };
  canteens: {
    total: number;
  };
  menuItems: {
    total: number;
  };
}

export interface RevenueBucketDto {
  periodStart: string;
  revenue: number;
  orderCount: number;
  averageOrderValue: number;
}

export interface RevenueAnalyticsDto extends AnalyticsRangeEnvelope {
  granularity: RevenueGranularityName;
  totalRevenue: number;
  totalOrderCount: number;
  averageOrderValue: number;
  buckets: RevenueBucketDto[];
}

export interface OrderAnalyticsDto extends AnalyticsRangeEnvelope {
  byStatus: Record<OrderStatus, number>;
  byDay: Array<{ date: string; count: number }>;
  byMonth: Array<{ month: string; count: number }>;
  peakOrderingHours: Array<{ hour: number; count: number }>;
  /** Minutes, `acceptedAt` -> `readyAt`. `null` when no order in range reached `ready`. */
  averagePreparationTimeMinutes: number | null;
  /** Percentage (0-100), `completed / total` orders in range. `0` when the range has no orders at all. */
  completionRate: number;
}

export interface MenuItemSalesDto {
  itemId: string;
  itemName: string;
  quantitySold: number;
  revenue: number;
}

export interface CategoryRevenueDto {
  categoryName: string;
  revenue: number;
  quantitySold: number;
}

export interface MenuAnalyticsDto extends AnalyticsRangeEnvelope {
  topSellingItems: MenuItemSalesDto[];
  leastSellingItems: MenuItemSalesDto[];
  revenuePerItem: MenuItemSalesDto[];
  revenuePerCategory: CategoryRevenueDto[];
}

export interface CanteenRevenueDto {
  canteenId: string;
  canteenName: string;
  revenue: number;
  orderCount: number;
}

export interface CanteenAnalyticsDto extends AnalyticsRangeEnvelope {
  /** Revenue *and* order count together, per canteen — one query answers "Revenue by Canteen" and "Orders by Canteen" at once, since both numbers come from the same group-by. See AnalyticsService's doc comment. */
  byCanteen: CanteenRevenueDto[];
  /** Top N of `byCanteen`, sorted by revenue — "Top Performing Canteens". */
  topPerforming: CanteenRevenueDto[];
}

export interface TopCustomerDto {
  userId: string;
  fullName: string;
  collegeEmail: string;
  orderCount: number;
  totalSpent: number;
}

export interface UserAnalyticsDto extends AnalyticsRangeEnvelope {
  newUsers: number;
  /** Distinct students who placed at least one order in range — see AnalyticsService's doc comment on why this isn't `IUser.isActive`. */
  activeUsers: number;
  /** Active users (above) with 2+ orders in range. */
  repeatCustomers: number;
  topCustomers: TopCustomerDto[];
}
