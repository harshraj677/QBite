import { z } from 'zod';

import {
  DATE_RANGE_FILTERS,
  DEFAULT_TOP_N,
  MAX_TOP_N,
  REVENUE_GRANULARITIES,
} from './analytics.constants';

/**
 * Shared shape every filtered analytics endpoint accepts — `filter`
 * plus the `startDate`/`endDate` pair `custom` needs. Kept as a plain
 * shape object (not a `z.object()`) so it can be spread into
 * per-endpoint schemas that add their own fields (`granularity`,
 * `limit`) — `ZodObject.extend()` isn't usable once `.refine()` has
 * been applied (it returns a `ZodEffects`, not a `ZodObject`), so the
 * refinement below is applied once per final schema instead of once
 * to a shared base.
 */
const baseFilterShape = {
  filter: z.enum(DATE_RANGE_FILTERS).default('last30days'),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
};

/**
 * `data` is cast to a known-safe shape inside each predicate rather
 * than typed through the generic — Zod's inferred output type for a
 * generic `Shape extends z.ZodRawShape` doesn't resolve cleanly
 * enough for TypeScript to see `filter`/`startDate`/`endDate` as
 * properties (every concrete call site below still gets full,
 * correct inference on its *return* type; only these two predicates'
 * parameter needs the cast).
 */
function withRangeRefinements<Shape extends z.ZodRawShape>(shape: Shape) {
  return z
    .object(shape)
    .refine(
      (data) => {
        const range = data as { filter?: string; startDate?: Date; endDate?: Date };
        return (
          range.filter !== 'custom' ||
          (range.startDate !== undefined && range.endDate !== undefined)
        );
      },
      {
        message: 'startDate and endDate are both required when filter is "custom".',
        path: ['startDate'],
      },
    )
    .refine(
      (data) => {
        const range = data as { startDate?: Date; endDate?: Date };
        return (
          !range.startDate || !range.endDate || range.startDate.getTime() <= range.endDate.getTime()
        );
      },
      { message: 'startDate must be before or equal to endDate.', path: ['endDate'] },
    );
}

const limitField = z.coerce.number().int().min(1).max(MAX_TOP_N).default(DEFAULT_TOP_N);

export const analyticsFilterQuerySchema = withRangeRefinements(baseFilterShape);
export type AnalyticsFilterQuery = z.infer<typeof analyticsFilterQuerySchema>;

export const revenueAnalyticsQuerySchema = withRangeRefinements({
  ...baseFilterShape,
  granularity: z.enum(REVENUE_GRANULARITIES).default('day'),
});
export type RevenueAnalyticsQuery = z.infer<typeof revenueAnalyticsQuerySchema>;

export const orderAnalyticsQuerySchema = analyticsFilterQuerySchema;
export type OrderAnalyticsQuery = AnalyticsFilterQuery;

export const menuAnalyticsQuerySchema = withRangeRefinements({
  ...baseFilterShape,
  limit: limitField,
});
export type MenuAnalyticsQuery = z.infer<typeof menuAnalyticsQuerySchema>;

export const canteenAnalyticsQuerySchema = withRangeRefinements({
  ...baseFilterShape,
  limit: limitField,
});
export type CanteenAnalyticsQuery = z.infer<typeof canteenAnalyticsQuerySchema>;

export const userAnalyticsQuerySchema = withRangeRefinements({
  ...baseFilterShape,
  limit: limitField,
});
export type UserAnalyticsQuery = z.infer<typeof userAnalyticsQuerySchema>;
