import { Types } from 'mongoose';

import type { CanteensService } from '@modules/canteens/canteens.service';
import type { MenuItemsService } from '@modules/menu/menu-items.service';
import type { OrdersService } from '@modules/orders/orders.service';
import type { IUser } from '@modules/users/user.types';
import type { UsersService } from '@modules/users/users.service';
import { AnalyticsService } from './analytics.service';

function makeMockOrdersService(): jest.Mocked<OrdersService> {
  return {
    getRevenueSummary: jest.fn().mockResolvedValue({ revenue: 0, orderCount: 0 }),
    getOrderStatusCounts: jest.fn().mockResolvedValue({
      pending: 0,
      accepted: 0,
      preparing: 0,
      ready: 0,
      completed: 0,
      cancelled: 0,
    }),
    getRevenueTimeSeries: jest.fn().mockResolvedValue([]),
    getOrdersByDay: jest.fn().mockResolvedValue([]),
    getOrdersByMonth: jest.fn().mockResolvedValue([]),
    getPeakOrderingHours: jest.fn().mockResolvedValue([]),
    getAveragePreparationTimeMinutes: jest.fn().mockResolvedValue(null),
    getRevenueByCanteen: jest.fn().mockResolvedValue([]),
    getCustomerOrderStats: jest.fn().mockResolvedValue([]),
    getItemSalesAggregate: jest.fn().mockResolvedValue([]),
    getCategoryRevenueAggregate: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<OrdersService>;
}

function makeMockUsersService(): jest.Mocked<UsersService> {
  return {
    getRoleCounts: jest.fn().mockResolvedValue({
      student: 0,
      kitchen_staff: 0,
      admin: 0,
      super_admin: 0,
    }),
    countNewUsers: jest.fn().mockResolvedValue(0),
    findByIds: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<UsersService>;
}

function makeMockCanteensService(): jest.Mocked<CanteensService> {
  return {
    countCanteens: jest.fn().mockResolvedValue(0),
    findByIds: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<CanteensService>;
}

function makeMockMenuItemsService(): jest.Mocked<MenuItemsService> {
  return {
    countItems: jest.fn().mockResolvedValue(0),
  } as unknown as jest.Mocked<MenuItemsService>;
}

function makeService(
  overrides: {
    ordersService?: jest.Mocked<OrdersService>;
    usersService?: jest.Mocked<UsersService>;
    canteensService?: jest.Mocked<CanteensService>;
    menuItemsService?: jest.Mocked<MenuItemsService>;
  } = {},
) {
  const ordersService = overrides.ordersService ?? makeMockOrdersService();
  const usersService = overrides.usersService ?? makeMockUsersService();
  const canteensService = overrides.canteensService ?? makeMockCanteensService();
  const menuItemsService = overrides.menuItemsService ?? makeMockMenuItemsService();
  return {
    service: new AnalyticsService(ordersService, usersService, canteensService, menuItemsService),
    ordersService,
    usersService,
    canteensService,
    menuItemsService,
  };
}

const baseFilterQuery = { filter: 'last30days' as const, startDate: undefined, endDate: undefined };

describe('AnalyticsService.getDashboardOverview', () => {
  it('sums byStatus into total orders and combines non-student roles into totalStaff', async () => {
    const { service, ordersService, usersService } = makeService();
    ordersService.getOrderStatusCounts.mockResolvedValue({
      pending: 2,
      accepted: 1,
      preparing: 0,
      ready: 0,
      completed: 3,
      cancelled: 1,
    });
    usersService.getRoleCounts.mockResolvedValue({
      student: 50,
      kitchen_staff: 4,
      admin: 2,
      super_admin: 1,
    });

    const result = await service.getDashboardOverview();

    expect(result.orders.total).toBe(7);
    expect(result.users.totalStudents).toBe(50);
    expect(result.users.totalStaff).toBe(7);
  });

  it('queries revenue for four independent windows: all-time, today, last7days, currentMonth', async () => {
    const { service, ordersService } = makeService();
    ordersService.getRevenueSummary
      .mockResolvedValueOnce({ revenue: 100000, orderCount: 10 }) // total
      .mockResolvedValueOnce({ revenue: 5000, orderCount: 1 }) // today
      .mockResolvedValueOnce({ revenue: 20000, orderCount: 4 }) // weekly
      .mockResolvedValueOnce({ revenue: 60000, orderCount: 8 }); // monthly

    const result = await service.getDashboardOverview();

    expect(ordersService.getRevenueSummary).toHaveBeenCalledTimes(4);
    expect(ordersService.getRevenueSummary).toHaveBeenNthCalledWith(1, {});
    expect(result.revenue).toEqual({ total: 100000, today: 5000, weekly: 20000, monthly: 60000 });
  });

  it('passes canteens/menu items counts through unchanged', async () => {
    const { service, canteensService, menuItemsService } = makeService();
    canteensService.countCanteens.mockResolvedValue(5);
    menuItemsService.countItems.mockResolvedValue(42);

    const result = await service.getDashboardOverview();

    expect(result.canteens.total).toBe(5);
    expect(result.menuItems.total).toBe(42);
  });
});

describe('AnalyticsService.getRevenueAnalytics', () => {
  it('computes averageOrderValue from summary and each bucket', async () => {
    const { service, ordersService } = makeService();
    ordersService.getRevenueSummary.mockResolvedValue({ revenue: 10000, orderCount: 4 });
    ordersService.getRevenueTimeSeries.mockResolvedValue([
      { periodStart: new Date('2026-01-01'), revenue: 6000, orderCount: 2 },
      { periodStart: new Date('2026-01-02'), revenue: 4000, orderCount: 2 },
    ]);

    const result = await service.getRevenueAnalytics({ ...baseFilterQuery, granularity: 'day' });

    expect(result.totalRevenue).toBe(10000);
    expect(result.averageOrderValue).toBe(2500);
    expect(result.buckets[0]).toMatchObject({
      revenue: 6000,
      orderCount: 2,
      averageOrderValue: 3000,
    });
  });

  it('returns 0 average when there are no orders (avoids NaN)', async () => {
    const { service } = makeService();

    const result = await service.getRevenueAnalytics({ ...baseFilterQuery, granularity: 'day' });

    expect(result.averageOrderValue).toBe(0);
    expect(result.totalRevenue).toBe(0);
  });

  it('resolves the window and passes it to both the summary and time-series calls', async () => {
    const { service, ordersService } = makeService();

    await service.getRevenueAnalytics({ ...baseFilterQuery, filter: 'today', granularity: 'day' });

    const summaryFilter = ordersService.getRevenueSummary.mock.calls[0][0] as {
      from: Date;
      to: Date;
    };
    const seriesFilter = ordersService.getRevenueTimeSeries.mock.calls[0][0] as {
      from: Date;
      to: Date;
      granularity: string;
    };
    expect(summaryFilter.from.getTime()).toBe(seriesFilter.from.getTime());
    expect(seriesFilter.granularity).toBe('day');
  });
});

describe('AnalyticsService.getOrderAnalytics', () => {
  it('computes completionRate as a percentage of completed/total', async () => {
    const { service, ordersService } = makeService();
    ordersService.getOrderStatusCounts.mockResolvedValue({
      pending: 1,
      accepted: 0,
      preparing: 0,
      ready: 0,
      completed: 3,
      cancelled: 1,
    });

    const result = await service.getOrderAnalytics(baseFilterQuery);

    expect(result.completionRate).toBe(60);
  });

  it('returns completionRate 0 for an empty range rather than NaN', async () => {
    const { service } = makeService();

    const result = await service.getOrderAnalytics(baseFilterQuery);

    expect(result.completionRate).toBe(0);
  });

  it('passes through a null averagePreparationTimeMinutes unchanged', async () => {
    const { service, ordersService } = makeService();
    ordersService.getAveragePreparationTimeMinutes.mockResolvedValue(null);

    const result = await service.getOrderAnalytics(baseFilterQuery);

    expect(result.averagePreparationTimeMinutes).toBeNull();
  });

  it('rounds a non-null averagePreparationTimeMinutes to 2 decimal places', async () => {
    const { service, ordersService } = makeService();
    ordersService.getAveragePreparationTimeMinutes.mockResolvedValue(12.3456);

    const result = await service.getOrderAnalytics(baseFilterQuery);

    expect(result.averagePreparationTimeMinutes).toBe(12.35);
  });
});

describe('AnalyticsService.getMenuAnalytics', () => {
  const itemSales = [
    { itemId: 'a', itemName: 'A', quantitySold: 10, revenue: 1000 },
    { itemId: 'b', itemName: 'B', quantitySold: 5, revenue: 5000 },
    { itemId: 'c', itemName: 'C', quantitySold: 1, revenue: 200 },
  ];

  it('derives topSelling/leastSelling/revenuePerItem from one aggregation call, not three', async () => {
    const { service, ordersService } = makeService();
    ordersService.getItemSalesAggregate.mockResolvedValue(itemSales);

    await service.getMenuAnalytics({ ...baseFilterQuery, limit: 10 });

    expect(ordersService.getItemSalesAggregate).toHaveBeenCalledTimes(1);
  });

  it('topSellingItems keeps the quantitySold-desc order already returned', async () => {
    const { service, ordersService } = makeService();
    ordersService.getItemSalesAggregate.mockResolvedValue(itemSales);

    const result = await service.getMenuAnalytics({ ...baseFilterQuery, limit: 10 });

    expect(result.topSellingItems.map((i) => i.itemId)).toEqual(['a', 'b', 'c']);
  });

  it('leastSellingItems sorts ascending by quantitySold', async () => {
    const { service, ordersService } = makeService();
    ordersService.getItemSalesAggregate.mockResolvedValue(itemSales);

    const result = await service.getMenuAnalytics({ ...baseFilterQuery, limit: 10 });

    expect(result.leastSellingItems.map((i) => i.itemId)).toEqual(['c', 'b', 'a']);
  });

  it('revenuePerItem sorts descending by revenue', async () => {
    const { service, ordersService } = makeService();
    ordersService.getItemSalesAggregate.mockResolvedValue(itemSales);

    const result = await service.getMenuAnalytics({ ...baseFilterQuery, limit: 10 });

    expect(result.revenuePerItem.map((i) => i.itemId)).toEqual(['b', 'a', 'c']);
  });

  it('respects the limit for all three lists', async () => {
    const { service, ordersService } = makeService();
    ordersService.getItemSalesAggregate.mockResolvedValue(itemSales);

    const result = await service.getMenuAnalytics({ ...baseFilterQuery, limit: 2 });

    expect(result.topSellingItems).toHaveLength(2);
    expect(result.leastSellingItems).toHaveLength(2);
    expect(result.revenuePerItem).toHaveLength(2);
  });
});

describe('AnalyticsService.getCanteenAnalytics', () => {
  it('enriches revenue rows with canteen names via a single batch findByIds call', async () => {
    const { service, ordersService, canteensService } = makeService();
    const canteenId = new Types.ObjectId();
    ordersService.getRevenueByCanteen.mockResolvedValue([
      { canteenId, revenue: 9000, orderCount: 3 },
    ]);
    canteensService.findByIds.mockResolvedValue([
      { id: canteenId.toString(), name: 'Main Canteen' } as never,
    ]);

    const result = await service.getCanteenAnalytics({ ...baseFilterQuery, limit: 10 });

    expect(canteensService.findByIds).toHaveBeenCalledTimes(1);
    expect(result.byCanteen[0]).toMatchObject({
      canteenId: canteenId.toString(),
      canteenName: 'Main Canteen',
      revenue: 9000,
      orderCount: 3,
    });
  });

  it('falls back to a placeholder name for a canteen findByIds does not return (e.g. soft-deleted)', async () => {
    const { service, ordersService, canteensService } = makeService();
    const canteenId = new Types.ObjectId();
    ordersService.getRevenueByCanteen.mockResolvedValue([
      { canteenId, revenue: 9000, orderCount: 3 },
    ]);
    canteensService.findByIds.mockResolvedValue([]);

    const result = await service.getCanteenAnalytics({ ...baseFilterQuery, limit: 10 });

    expect(result.byCanteen[0].canteenName).toBe('Unknown Canteen');
  });

  it('topPerforming is the top-N slice of byCanteen (already revenue-sorted)', async () => {
    const { service, ordersService } = makeService();
    const a = new Types.ObjectId();
    const b = new Types.ObjectId();
    ordersService.getRevenueByCanteen.mockResolvedValue([
      { canteenId: a, revenue: 9000, orderCount: 3 },
      { canteenId: b, revenue: 1000, orderCount: 1 },
    ]);

    const result = await service.getCanteenAnalytics({ ...baseFilterQuery, limit: 1 });

    expect(result.topPerforming).toHaveLength(1);
    expect(result.topPerforming[0].canteenId).toBe(a.toString());
  });
});

describe('AnalyticsService.getUserAnalytics', () => {
  it('activeUsers is the count of distinct customer-stats rows', async () => {
    const { service, ordersService } = makeService();
    ordersService.getCustomerOrderStats.mockResolvedValue([
      { studentId: new Types.ObjectId(), orderCount: 1, totalSpent: 1000 },
      { studentId: new Types.ObjectId(), orderCount: 3, totalSpent: 5000 },
    ]);

    const result = await service.getUserAnalytics({ ...baseFilterQuery, limit: 10 });

    expect(result.activeUsers).toBe(2);
  });

  it('repeatCustomers only counts students with 2+ orders in range', async () => {
    const { service, ordersService } = makeService();
    ordersService.getCustomerOrderStats.mockResolvedValue([
      { studentId: new Types.ObjectId(), orderCount: 1, totalSpent: 1000 },
      { studentId: new Types.ObjectId(), orderCount: 3, totalSpent: 5000 },
      { studentId: new Types.ObjectId(), orderCount: 2, totalSpent: 2000 },
    ]);

    const result = await service.getUserAnalytics({ ...baseFilterQuery, limit: 10 });

    expect(result.repeatCustomers).toBe(2);
  });

  it('topCustomers sorts by totalSpent descending and enriches with user details', async () => {
    const { service, ordersService, usersService } = makeService();
    const low = new Types.ObjectId();
    const high = new Types.ObjectId();
    ordersService.getCustomerOrderStats.mockResolvedValue([
      { studentId: low, orderCount: 1, totalSpent: 1000 },
      { studentId: high, orderCount: 2, totalSpent: 9000 },
    ]);
    usersService.findByIds.mockResolvedValue([
      { _id: high, fullName: 'Big Spender', collegeEmail: 'big@college.edu' } as unknown as IUser,
      {
        _id: low,
        fullName: 'Small Spender',
        collegeEmail: 'small@college.edu',
      } as unknown as IUser,
    ]);

    const result = await service.getUserAnalytics({ ...baseFilterQuery, limit: 10 });

    expect(result.topCustomers[0]).toMatchObject({
      userId: high.toString(),
      fullName: 'Big Spender',
      totalSpent: 9000,
    });
  });

  it('respects the limit on topCustomers without limiting activeUsers/repeatCustomers', async () => {
    const { service, ordersService } = makeService();
    ordersService.getCustomerOrderStats.mockResolvedValue([
      { studentId: new Types.ObjectId(), orderCount: 2, totalSpent: 3000 },
      { studentId: new Types.ObjectId(), orderCount: 2, totalSpent: 2000 },
      { studentId: new Types.ObjectId(), orderCount: 2, totalSpent: 1000 },
    ]);

    const result = await service.getUserAnalytics({ ...baseFilterQuery, limit: 1 });

    expect(result.topCustomers).toHaveLength(1);
    expect(result.activeUsers).toBe(3);
    expect(result.repeatCustomers).toBe(3);
  });

  it('falls back to placeholder name/email for a customer findByIds does not return', async () => {
    const { service, ordersService, usersService } = makeService();
    ordersService.getCustomerOrderStats.mockResolvedValue([
      { studentId: new Types.ObjectId(), orderCount: 2, totalSpent: 1000 },
    ]);
    usersService.findByIds.mockResolvedValue([]);

    const result = await service.getUserAnalytics({ ...baseFilterQuery, limit: 10 });

    expect(result.topCustomers[0]).toMatchObject({ fullName: 'Unknown', collegeEmail: '' });
  });
});
