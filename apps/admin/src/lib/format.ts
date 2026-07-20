/** Every money value from the backend is an integer in paise (see docs/DATABASE_DESIGN.md §6) — this is the one place that convention gets turned into a display string. */
export function formatCurrency(amountInPaise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amountInPaise / 100);
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-IN', { notation: 'compact' }).format(value);
}

/** Compact axis/tooltip label for a bucket's `periodStart` — the label shape depends on how coarse the bucket already is server-side (day/week/month/year), not on formatting logic re-deriving it. */
export function formatChartDate(iso: string, granularity: 'day' | 'week' | 'month' | 'year'): string {
  const date = new Date(iso);
  if (granularity === 'year') return date.toLocaleDateString('en-IN', { year: 'numeric' });
  if (granularity === 'month') return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** `14` -> "2 PM" — used by the Peak Ordering Hours chart's x-axis. */
export function formatHourLabel(hour: number): string {
  const period = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour} ${period}`;
}
