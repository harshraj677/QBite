import { CanteensService } from '@modules/canteens/canteens.service';
import { MenuItemsService } from '@modules/menu/menu-items.service';
import { OrdersService } from '@modules/orders/orders.service';
import { UsersService } from '@modules/users/users.service';
import { resolveDateRange } from './analytics.constants';
import type {
  CanteenAnalyticsDto,
  CanteenRevenueDto,
  DashboardOverviewDto,
  MenuAnalyticsDto,
  OrderAnalyticsDto,
  RevenueAnalyticsDto,
  TopCustomerDto,
  UserAnalyticsDto,
} from './analytics.types';
import type {
  CanteenAnalyticsQuery,
  MenuAnalyticsQuery,
  OrderAnalyticsQuery,
  RevenueAnalyticsQuery,
  UserAnalyticsQuery,
} from './analytics.validation';

/** Integer paise, rounded — never a fraction of a paisa. `0` when there are no orders to average, rather than NaN. */
function averageOrderValue(revenue: number, orderCount: number): number {
  return orderCount > 0 ? Math.round(revenue / orderCount) : 0;
}

/**
 * Business logic for `analytics`. Deliberately has **no repository or
 * model of its own** — this module owns no MongoDB collection, so
 * there is nothing for an `analytics.repository.ts` to wrap; every
 * number below is computed by calling `OrdersService`/`UsersService`/
 * `CanteensService`/`MenuItemsService`'s own read methods (added for
 * this phase — see each method's doc comment and ARCHITECTURE.md
 * §3.1's `modules/analytics` note), never a repository or Mongoose
 * model directly. This is the same "pure orchestration, no data of
 * its own" shape `modules/kitchen` already established, applied here
 * to a reporting concern instead of a workflow-facade one.
 */
export class AnalyticsService {
  constructor(
    private readonly ordersService: OrdersService = new OrdersService(),
    private readonly usersService: UsersService = new UsersService(),
    private readonly canteensService: CanteensService = new CanteensService(),
    private readonly menuItemsService: MenuItemsService = new MenuItemsService(),
  ) {}

  /**
   * No filter — a dashboard is a live snapshot, not a report over a
   * chosen window. "Total Revenue"/"Total Orders" are all-time;
   * "Today's"/"Weekly"/"Monthly Revenue" are three independent fixed
   * windows (`today`, `last7days`, `currentMonth`) resolved
   * internally, not something the caller picks.
   */
  async getDashboardOverview(): Promise<DashboardOverviewDto> {
    const today = resolveDateRange('today');
    const weekly = resolveDateRange('last7days');
    const monthly = resolveDateRange('currentMonth');

    const [
      totalRevenue,
      todayRevenue,
      weeklyRevenue,
      monthlyRevenue,
      statusCounts,
      roleCounts,
      canteenCount,
      menuItemCount,
    ] = await Promise.all([
      this.ordersService.getRevenueSummary({}),
      this.ordersService.getRevenueSummary(today),
      this.ordersService.getRevenueSummary(weekly),
      this.ordersService.getRevenueSummary(monthly),
      this.ordersService.getOrderStatusCounts(),
      this.usersService.getRoleCounts(),
      this.canteensService.countCanteens(),
      this.menuItemsService.countItems(),
    ]);

    const totalOrders = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
    // "Staff" = every role that isn't `student` — kitchen_staff runs
    // the kitchen, admin/super_admin run the platform; all three are
    // "not a customer" for a dashboard's purposes. Documented here
    // since the spec doesn't define the split itself.
    const totalStaff = roleCounts.kitchen_staff + roleCounts.admin + roleCounts.super_admin;

    return {
      revenue: {
        total: totalRevenue.revenue,
        today: todayRevenue.revenue,
        weekly: weeklyRevenue.revenue,
        monthly: monthlyRevenue.revenue,
      },
      orders: { total: totalOrders, byStatus: statusCounts },
      users: { totalStudents: roleCounts.student, totalStaff },
      canteens: { total: canteenCount },
      menuItems: { total: menuItemCount },
    };
  }

  async getRevenueAnalytics(query: RevenueAnalyticsQuery): Promise<RevenueAnalyticsDto> {
    const { from, to } = resolveDateRange(query.filter, query.startDate, query.endDate);
    const [summary, buckets] = await Promise.all([
      this.ordersService.getRevenueSummary({ from, to }),
      this.ordersService.getRevenueTimeSeries({ from, to, granularity: query.granularity }),
    ]);

    return {
      filter: query.filter,
      from: from.toISOString(),
      to: to.toISOString(),
      granularity: query.granularity,
      totalRevenue: summary.revenue,
      totalOrderCount: summary.orderCount,
      averageOrderValue: averageOrderValue(summary.revenue, summary.orderCount),
      buckets: buckets.map((bucket) => ({
        periodStart: bucket.periodStart.toISOString(),
        revenue: bucket.revenue,
        orderCount: bucket.orderCount,
        averageOrderValue: averageOrderValue(bucket.revenue, bucket.orderCount),
      })),
    };
  }

  async getOrderAnalytics(query: OrderAnalyticsQuery): Promise<OrderAnalyticsDto> {
    const { from, to } = resolveDateRange(query.filter, query.startDate, query.endDate);
    const [byStatus, byDay, byMonth, peakOrderingHours, averagePreparationTimeMinutes] =
      await Promise.all([
        this.ordersService.getOrderStatusCounts({ from, to }),
        this.ordersService.getOrdersByDay({ from, to }),
        this.ordersService.getOrdersByMonth({ from, to }),
        this.ordersService.getPeakOrderingHours({ from, to }),
        this.ordersService.getAveragePreparationTimeMinutes({ from, to }),
      ]);

    const total = Object.values(byStatus).reduce((sum, count) => sum + count, 0);
    // completed / total (every order in range, not just terminal
    // ones) — "what fraction of everything ordered this window
    // actually got completed." 0 for an empty range rather than NaN.
    const completionRate = total > 0 ? Math.round((byStatus.completed / total) * 10000) / 100 : 0;

    return {
      filter: query.filter,
      from: from.toISOString(),
      to: to.toISOString(),
      byStatus,
      byDay: byDay.map((row) => ({ date: row.date.toISOString(), count: row.count })),
      byMonth: byMonth.map((row) => ({ month: row.month.toISOString(), count: row.count })),
      peakOrderingHours,
      averagePreparationTimeMinutes:
        averagePreparationTimeMinutes === null
          ? null
          : Math.round(averagePreparationTimeMinutes * 100) / 100,
      completionRate,
    };
  }

  /**
   * One aggregation (`getItemSalesAggregate`) serves top-selling,
   * least-selling, *and* revenue-per-item — each is a different
   * sort/slice of the same result set, not three separate queries.
   */
  async getMenuAnalytics(query: MenuAnalyticsQuery): Promise<MenuAnalyticsDto> {
    const { from, to } = resolveDateRange(query.filter, query.startDate, query.endDate);
    const [itemSales, revenuePerCategory] = await Promise.all([
      this.ordersService.getItemSalesAggregate({ from, to }),
      this.ordersService.getCategoryRevenueAggregate({ from, to }),
    ]);

    // Already sorted by quantitySold desc (see OrderItemsRepository.getItemSalesAggregate).
    const topSellingItems = itemSales.slice(0, query.limit);
    const leastSellingItems = [...itemSales]
      .sort((a, b) => a.quantitySold - b.quantitySold)
      .slice(0, query.limit);
    const revenuePerItem = [...itemSales]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, query.limit);

    return {
      filter: query.filter,
      from: from.toISOString(),
      to: to.toISOString(),
      topSellingItems,
      leastSellingItems,
      revenuePerItem,
      revenuePerCategory,
    };
  }

  /**
   * `byCanteen` answers "Revenue by Canteen" and "Orders by Canteen"
   * in one array — both numbers come from the same
   * `getRevenueByCanteen` group-by, so returning them as two
   * identical-except-for-one-field arrays would just double the
   * payload for no new information. `topPerforming` is that same
   * array's top N by revenue (already sorted server-side).
   */
  async getCanteenAnalytics(query: CanteenAnalyticsQuery): Promise<CanteenAnalyticsDto> {
    const { from, to } = resolveDateRange(query.filter, query.startDate, query.endDate);
    const rows = await this.ordersService.getRevenueByCanteen({ from, to });

    const canteens = await this.canteensService.findByIds(
      rows.map((row) => row.canteenId.toString()),
    );
    const nameById = new Map(canteens.map((canteen) => [canteen.id, canteen.name]));

    // A canteen that generated historical revenue and was later
    // soft-deleted won't resolve a name here (findByIds excludes
    // soft-deleted canteens, same as every other canteen read in this
    // codebase) — falls back to a placeholder rather than dropping
    // the row, since the revenue figure itself is still real.
    const byCanteen: CanteenRevenueDto[] = rows.map((row) => ({
      canteenId: row.canteenId.toString(),
      canteenName: nameById.get(row.canteenId.toString()) ?? 'Unknown Canteen',
      revenue: row.revenue,
      orderCount: row.orderCount,
    }));

    return {
      filter: query.filter,
      from: from.toISOString(),
      to: to.toISOString(),
      byCanteen,
      topPerforming: byCanteen.slice(0, query.limit),
    };
  }

  /**
   * "Active" here means "placed at least one order in range" — a
   * behavioral, order-domain signal — not `IUser.isActive` (which
   * means "account not disabled," a completely different concept
   * already used to gate login). Active/Repeat/Top Customers all
   * derive from one `getCustomerOrderStats` aggregation, not three
   * separate queries.
   */
  async getUserAnalytics(query: UserAnalyticsQuery): Promise<UserAnalyticsDto> {
    const { from, to } = resolveDateRange(query.filter, query.startDate, query.endDate);
    const [newUsers, customerStats] = await Promise.all([
      this.usersService.countNewUsers({ from, to }),
      this.ordersService.getCustomerOrderStats({ from, to }),
    ]);

    const activeUsers = customerStats.length;
    const repeatCustomers = customerStats.filter((stat) => stat.orderCount >= 2).length;

    const topStats = [...customerStats]
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, query.limit);
    const users = await this.usersService.findByIds(
      topStats.map((stat) => stat.studentId.toString()),
    );
    const userById = new Map(users.map((user) => [user._id.toString(), user]));

    const topCustomers: TopCustomerDto[] = topStats.map((stat) => {
      const user = userById.get(stat.studentId.toString());
      return {
        userId: stat.studentId.toString(),
        fullName: user?.fullName ?? 'Unknown',
        collegeEmail: user?.collegeEmail ?? '',
        orderCount: stat.orderCount,
        totalSpent: stat.totalSpent,
      };
    });

    return {
      filter: query.filter,
      from: from.toISOString(),
      to: to.toISOString(),
      newUsers,
      activeUsers,
      repeatCustomers,
      topCustomers,
    };
  }
}
