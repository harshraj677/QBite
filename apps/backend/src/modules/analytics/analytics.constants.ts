/**
 * Every preset the spec's FILTERS section lists, plus `custom`
 * (paired with `startDate`/`endDate` — see analytics.validation.ts's
 * refinement). Applies uniformly to Revenue/Order/Menu/Canteen/User
 * Analytics; `GET /analytics/dashboard` takes no filter at all — see
 * AnalyticsService.getDashboardOverview's doc comment for why.
 */
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

/** Revenue Analytics' bucket size for its time series — a second, independent axis from DATE_RANGE_FILTERS above (that picks *which window*; this picks *how finely to slice it*). */
export const REVENUE_GRANULARITIES = ['day', 'week', 'month', 'year'] as const;
export type RevenueGranularityName = (typeof REVENUE_GRANULARITIES)[number];

/** "Top N" list size for top-selling/least-selling items, top-performing canteens, top customers. */
export const DEFAULT_TOP_N = 10;
export const MAX_TOP_N = 50;

export interface ResolvedDateRange {
  from: Date;
  to: Date;
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Turns a filter preset (+ optional custom bounds) into a concrete
 * `{from, to}` window, evaluated against the current wall-clock time
 * at call time — every analytics endpoint resolves its own range
 * fresh per request, nothing is cached or pre-computed. `custom`
 * without both bounds falls back to "today" rather than throwing;
 * analytics.validation.ts's schema already guarantees a real request
 * can't reach this function in that state, so the fallback only
 * matters for direct unit tests of this function in isolation.
 */
export function resolveDateRange(
  filter: DateRangeFilterName,
  startDate?: Date,
  endDate?: Date,
): ResolvedDateRange {
  const now = new Date();
  switch (filter) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'yesterday': {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
    }
    case 'last7days': {
      const from = new Date(now);
      from.setDate(from.getDate() - 6);
      return { from: startOfDay(from), to: endOfDay(now) };
    }
    case 'last30days': {
      const from = new Date(now);
      from.setDate(from.getDate() - 29);
      return { from: startOfDay(from), to: endOfDay(now) };
    }
    case 'currentMonth':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
    case 'previousMonth': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { from, to };
    }
    case 'currentYear':
      return { from: new Date(now.getFullYear(), 0, 1), to: endOfDay(now) };
    case 'custom':
      return {
        from: startDate ? startOfDay(startDate) : startOfDay(now),
        to: endDate ? endOfDay(endDate) : endOfDay(now),
      };
  }
}
