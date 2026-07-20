/** Mirrors apps/backend/src/modules/analytics/analytics.types.ts + analytics.constants.ts exactly. */

// Imported from, and re-exported to, the app-wide shared location
// (see types/order.ts's doc comment) — re-exported here too so every
// existing import in this feature (`from './types'`) keeps working
// unchanged.
import type { OrderStatus } from '@/types/order';
export type {
  OrderDto,
  OrderItemDto,
  OrderItemSnapshot,
  OrderStatus,
  OrderWithItemsDto,
  PaymentMethod,
  PaymentStatus,
} from '@/types/order';

export const DATE_RANGE_FILTERS = [
  'today',
  'yesterday',
  'last7days',
  'last30days',
  'currentMonth',
  'previousMonth',
  'currentYear',
  'custom',
] as const;
export type DateRangeFilterName = (typeof DATE_RANGE_FILTERS)[number];

export const REVENUE_GRANULARITIES = ['day', 'week', 'month', 'year'] as const;
export type RevenueGranularityName = (typeof REVENUE_GRANULARITIES)[number];

export interface AnalyticsFilterQuery {
  filter?: DateRangeFilterName;
  startDate?: string;
  endDate?: string;
}

interface AnalyticsRangeEnvelope {
  filter: DateRangeFilterName;
  from: string;
  to: string;
}

export interface DashboardOverviewDto {
  revenue: {
    total: number;
    today: number;
    weekly: number;
    monthly: number;
  };
  orders: {
    total: number;
    byStatus: Record<OrderStatus, number>;
  };
  users: {
    totalStudents: number;
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
  averagePreparationTimeMinutes: number | null;
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
  byCanteen: CanteenRevenueDto[];
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
  activeUsers: number;
  repeatCustomers: number;
  topCustomers: TopCustomerDto[];
}
