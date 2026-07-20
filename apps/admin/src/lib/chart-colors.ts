/**
 * References the `--chart-1`..`--chart-5` tokens from globals.css —
 * never a hardcoded hex in a chart component. Recharts accepts a CSS
 * `var(...)` string directly as a `fill`/`stroke` value (resolved by
 * the browser like any other SVG presentation attribute), so every
 * chart automatically follows the design system across light/dark
 * with zero per-chart theme logic.
 */
export const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
] as const;

export const CHART_GRID_COLOR = 'var(--border)';
export const CHART_TEXT_COLOR = 'var(--muted-foreground)';
