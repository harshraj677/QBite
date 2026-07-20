import { sendSuccess } from '@response/api-response';
import { catchAsync } from '@utils/async-handler';
import { AnalyticsService } from './analytics.service';
import type {
  CanteenAnalyticsQuery,
  MenuAnalyticsQuery,
  OrderAnalyticsQuery,
  RevenueAnalyticsQuery,
  UserAnalyticsQuery,
} from './analytics.validation';

/** Every handler is `catchAsync`-wrapped and does nothing beyond: parse the query, call AnalyticsService, shape the response — same convention as every other module's controller. No request body anywhere in this module (every endpoint is a GET). */
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService = new AnalyticsService()) {}

  getDashboard = catchAsync(async (_req, res) => {
    const dashboard = await this.analyticsService.getDashboardOverview();
    sendSuccess(res, dashboard);
  });

  getRevenue = catchAsync(async (req, res) => {
    const query = req.query as unknown as RevenueAnalyticsQuery;
    const revenue = await this.analyticsService.getRevenueAnalytics(query);
    sendSuccess(res, revenue);
  });

  getOrders = catchAsync(async (req, res) => {
    const query = req.query as unknown as OrderAnalyticsQuery;
    const orders = await this.analyticsService.getOrderAnalytics(query);
    sendSuccess(res, orders);
  });

  getMenu = catchAsync(async (req, res) => {
    const query = req.query as unknown as MenuAnalyticsQuery;
    const menu = await this.analyticsService.getMenuAnalytics(query);
    sendSuccess(res, menu);
  });

  getCanteens = catchAsync(async (req, res) => {
    const query = req.query as unknown as CanteenAnalyticsQuery;
    const canteens = await this.analyticsService.getCanteenAnalytics(query);
    sendSuccess(res, canteens);
  });

  getUsers = catchAsync(async (req, res) => {
    const query = req.query as unknown as UserAnalyticsQuery;
    const users = await this.analyticsService.getUserAnalytics(query);
    sendSuccess(res, users);
  });
}
