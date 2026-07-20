interface DatedValue {
  date: string;
  value: number;
}

/**
 * Real period-over-period comparison derived from a daily time series
 * the dashboard is already fetching for its charts (revenue buckets /
 * orders-by-day) — no extra request. Splits the series into its most
 * recent `windowDays` and the `windowDays` immediately before that,
 * and returns the signed percentage change between the two sums.
 * `null` when there isn't enough history yet, or the prior window
 * summed to zero (a percentage change from zero is undefined, not
 * "infinite growth") — callers should omit the trend UI entirely in
 * that case rather than show a fabricated number.
 */
export function computeTrend(series: DatedValue[], windowDays = 7): number | null {
  if (series.length < windowDays * 2) return null;
  const sorted = [...series].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const recent = sorted.slice(-windowDays);
  const prior = sorted.slice(-windowDays * 2, -windowDays);
  const recentSum = recent.reduce((sum, x) => sum + x.value, 0);
  const priorSum = prior.reduce((sum, x) => sum + x.value, 0);
  if (priorSum === 0) return null;
  return Math.round(((recentSum - priorSum) / priorSum) * 1000) / 10;
}
