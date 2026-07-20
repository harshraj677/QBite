import { Router } from 'express';

import { authenticate, requireRole } from '@modules/auth/auth.middleware';
import { validateRequest } from '@validation/validate-request.middleware';
import { AnalyticsController } from './analytics.controller';
import {
  canteenAnalyticsQuerySchema,
  menuAnalyticsQuerySchema,
  orderAnalyticsQuerySchema,
  revenueAnalyticsQuerySchema,
  userAnalyticsQuerySchema,
} from './analytics.validation';

export const analyticsRouter = Router();
const controller = new AnalyticsController();

/** Admin only, per the phase spec's "Security: Admin only" — no kitchen_staff/student path exists to any endpoint in this module. */
const ADMIN_ROLES = ['admin', 'super_admin'] as const;

/**
 * @openapi
 * /api/v1/analytics/dashboard:
 *   get:
 *     summary: Dashboard overview — a live, unfiltered snapshot
 *     description: Admin/super_admin only. Read-only; touches no business data. Revenue is `total` (all-time) plus three fixed windows (today, last 7 days, current month) — not affected by any query parameter. Order/user/canteen/menu-item counts are current totals.
 *     tags: [Analytics]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Dashboard overview.
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: Authenticated as a role other than admin/super_admin.
 */
analyticsRouter.get(
  '/dashboard',
  authenticate(),
  requireRole(...ADMIN_ROLES),
  controller.getDashboard,
);

/**
 * @openapi
 * /api/v1/analytics/revenue:
 *   get:
 *     summary: Revenue analytics — time series over a filtered window
 *     description: Admin/super_admin only. Read-only. `granularity` controls the time-series bucket size independently of `filter`, which controls the overall window.
 *     tags: [Analytics]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: filter
 *         schema: { type: string, enum: [today, yesterday, last7days, last30days, currentMonth, previousMonth, currentYear, custom], default: last30days }
 *       - in: query
 *         name: startDate
 *         description: Required (with endDate) when filter=custom.
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         description: Required (with startDate) when filter=custom.
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: granularity
 *         schema: { type: string, enum: [day, week, month, year], default: day }
 *     responses:
 *       200:
 *         description: Revenue summary + time series for the resolved window.
 *       400:
 *         description: filter=custom without both startDate and endDate, or startDate after endDate.
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: Authenticated as a role other than admin/super_admin.
 */
analyticsRouter.get(
  '/revenue',
  authenticate(),
  requireRole(...ADMIN_ROLES),
  validateRequest({ query: revenueAnalyticsQuerySchema }),
  controller.getRevenue,
);

/**
 * @openapi
 * /api/v1/analytics/orders:
 *   get:
 *     summary: Order analytics over a filtered window
 *     description: Admin/super_admin only. Read-only. `completionRate` is `completed / total` orders in the window, as a percentage; `averagePreparationTimeMinutes` is `null` when no order in range reached `ready`.
 *     tags: [Analytics]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: filter
 *         schema: { type: string, enum: [today, yesterday, last7days, last30days, currentMonth, previousMonth, currentYear, custom], default: last30days }
 *       - in: query
 *         name: startDate
 *         description: Required (with endDate) when filter=custom.
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         description: Required (with startDate) when filter=custom.
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Order breakdown/trends for the resolved window.
 *       400:
 *         description: filter=custom without both startDate and endDate, or startDate after endDate.
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: Authenticated as a role other than admin/super_admin.
 */
analyticsRouter.get(
  '/orders',
  authenticate(),
  requireRole(...ADMIN_ROLES),
  validateRequest({ query: orderAnalyticsQuerySchema }),
  controller.getOrders,
);

/**
 * @openapi
 * /api/v1/analytics/menu:
 *   get:
 *     summary: Menu analytics over a filtered window
 *     description: Admin/super_admin only. Read-only. Items with zero orders in the window never appear (top/least-selling and revenue-per-item all derive from actual order history, not the menu catalog) — a documented scope limit, not a bug.
 *     tags: [Analytics]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: filter
 *         schema: { type: string, enum: [today, yesterday, last7days, last30days, currentMonth, previousMonth, currentYear, custom], default: last30days }
 *       - in: query
 *         name: startDate
 *         description: Required (with endDate) when filter=custom.
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         description: Required (with startDate) when filter=custom.
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: limit
 *         description: Max rows per list (top-selling, least-selling, revenue-per-item).
 *         schema: { type: integer, default: 10, maximum: 50 }
 *     responses:
 *       200:
 *         description: Menu sales breakdown for the resolved window.
 *       400:
 *         description: filter=custom without both startDate and endDate, or startDate after endDate.
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: Authenticated as a role other than admin/super_admin.
 */
analyticsRouter.get(
  '/menu',
  authenticate(),
  requireRole(...ADMIN_ROLES),
  validateRequest({ query: menuAnalyticsQuerySchema }),
  controller.getMenu,
);

/**
 * @openapi
 * /api/v1/analytics/canteens:
 *   get:
 *     summary: Canteen analytics over a filtered window
 *     description: Admin/super_admin only. Read-only. `byCanteen` carries both revenue and order count per canteen (one group-by answers both); `topPerforming` is its top-N slice by revenue.
 *     tags: [Analytics]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: filter
 *         schema: { type: string, enum: [today, yesterday, last7days, last30days, currentMonth, previousMonth, currentYear, custom], default: last30days }
 *       - in: query
 *         name: startDate
 *         description: Required (with endDate) when filter=custom.
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         description: Required (with startDate) when filter=custom.
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: limit
 *         description: Max rows in topPerforming.
 *         schema: { type: integer, default: 10, maximum: 50 }
 *     responses:
 *       200:
 *         description: Per-canteen revenue/order breakdown for the resolved window.
 *       400:
 *         description: filter=custom without both startDate and endDate, or startDate after endDate.
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: Authenticated as a role other than admin/super_admin.
 */
analyticsRouter.get(
  '/canteens',
  authenticate(),
  requireRole(...ADMIN_ROLES),
  validateRequest({ query: canteenAnalyticsQuerySchema }),
  controller.getCanteens,
);

/**
 * @openapi
 * /api/v1/analytics/users:
 *   get:
 *     summary: User/customer analytics over a filtered window
 *     description: Admin/super_admin only. Read-only. "Active" means placed >=1 order in the window (not IUser.isActive, a different "account not disabled" concept); "Repeat Customers" is active users with 2+ orders in the same window.
 *     tags: [Analytics]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: filter
 *         schema: { type: string, enum: [today, yesterday, last7days, last30days, currentMonth, previousMonth, currentYear, custom], default: last30days }
 *       - in: query
 *         name: startDate
 *         description: Required (with endDate) when filter=custom.
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         description: Required (with startDate) when filter=custom.
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: limit
 *         description: Max rows in topCustomers.
 *         schema: { type: integer, default: 10, maximum: 50 }
 *     responses:
 *       200:
 *         description: User/customer breakdown for the resolved window.
 *       400:
 *         description: filter=custom without both startDate and endDate, or startDate after endDate.
 *       401:
 *         description: Missing/invalid access token.
 *       403:
 *         description: Authenticated as a role other than admin/super_admin.
 */
analyticsRouter.get(
  '/users',
  authenticate(),
  requireRole(...ADMIN_ROLES),
  validateRequest({ query: userAnalyticsQuerySchema }),
  controller.getUsers,
);
