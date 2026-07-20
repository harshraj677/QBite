import { apiFetchData, type QueryValue } from '@/lib/api/client';
import type {
  AnalyticsFilterQuery,
  CanteenAnalyticsDto,
  DashboardOverviewDto,
  MenuAnalyticsDto,
  OrderAnalyticsDto,
  OrderDto,
  OrderWithItemsDto,
  RevenueAnalyticsDto,
  RevenueGranularityName,
  UserAnalyticsDto,
} from './types';

export function getDashboardOverview(): Promise<DashboardOverviewDto> {
  return apiFetchData<DashboardOverviewDto>('/analytics/dashboard');
}

export function getRevenueAnalytics(
  query: AnalyticsFilterQuery & { granularity?: RevenueGranularityName },
): Promise<RevenueAnalyticsDto> {
  return apiFetchData<RevenueAnalyticsDto>('/analytics/revenue', {
    query: query as Record<string, QueryValue>,
  });
}

export function getOrderAnalytics(query: AnalyticsFilterQuery): Promise<OrderAnalyticsDto> {
  return apiFetchData<OrderAnalyticsDto>('/analytics/orders', {
    query: query as Record<string, QueryValue>,
  });
}

export function getMenuAnalytics(
  query: AnalyticsFilterQuery & { limit?: number },
): Promise<MenuAnalyticsDto> {
  return apiFetchData<MenuAnalyticsDto>('/analytics/menu', {
    query: query as Record<string, QueryValue>,
  });
}

export function getCanteenAnalytics(
  query: AnalyticsFilterQuery & { limit?: number },
): Promise<CanteenAnalyticsDto> {
  return apiFetchData<CanteenAnalyticsDto>('/analytics/canteens', {
    query: query as Record<string, QueryValue>,
  });
}

export function getUserAnalytics(
  query: AnalyticsFilterQuery & { limit?: number },
): Promise<UserAnalyticsDto> {
  return apiFetchData<UserAnalyticsDto>('/analytics/users', {
    query: query as Record<string, QueryValue>,
  });
}

/**
 * `GET /kitchen/orders` — unscoped across every canteen, real order
 * records (not an aggregate), without line items (the list endpoint
 * deliberately omits them; see `GET /orders/:id` below for those).
 * This is the one non-analytics endpoint the dashboard calls, and
 * only for the two explicitly-requested sections analytics endpoints
 * structurally can't answer: "Recent Orders" and "Live Activity" (see
 * types.ts's `OrderDto` doc comment).
 */
export function getRecentOrders(params: { limit?: number } = {}): Promise<OrderDto[]> {
  return apiFetchData<OrderDto[]>('/kitchen/orders', {
    query: { limit: params.limit ?? 20, sortOrder: 'desc' },
  });
}

/**
 * `GET /orders/:id` — powers the Recent Orders table's "View details"
 * quick-look sheet. Kitchen staff/admin/super_admin may view any order
 * (see orders.service.ts's `getOrderById`). Unwraps the response's
 * `{ order: {...} }` envelope explicitly — `sendSuccess(res, { order
 * })` on the backend never returns the bare resource, and typing it
 * away with `apiFetchData<OrderWithItemsDto>(...)` was a real bug (see
 * features/orders/api.ts's `getOrderDetail` doc comment for the full
 * story of how this was found and confirmed).
 */
export async function getOrderDetail(id: string): Promise<OrderWithItemsDto> {
  const { order } = await apiFetchData<{ order: OrderWithItemsDto }>(`/orders/${id}`);
  return order;
}
