import { TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { AnimatedNumber } from './animated-number';

interface StatCardTrend {
  /** Signed percentage, e.g. 12.4 or -3.1 — the sign alone decides up/down styling, no separate `direction` flag to keep in sync. */
  value: number;
  /** What the trend is relative to, e.g. "vs last week" — always shown next to the delta so it's never ambiguous what's being compared. */
  label: string;
}

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  trend?: StatCardTrend;
  loading?: boolean;
  className?: string;
  /** Hover context on the icon — what this number means/covers. Optional; the icon renders identically without one. */
  tooltip?: string;
  /**
   * When provided together with `format`, `value` above is ignored and
   * the number counts up via `AnimatedNumber` instead of rendering
   * statically — additive, opt-in, so every pre-existing call site
   * (which only ever passed a pre-formatted `value`) renders exactly
   * as before.
   */
  rawValue?: number;
  format?: (value: number) => string;
}

/**
 * The one metric-card pattern for every stat surfaced anywhere in the
 * app (Dashboard today; Analytics/Reports later) — see
 * docs/DESIGN_SYSTEM.md. `loading` renders a skeleton at the exact
 * dimensions of the real content so a card never visibly jumps in
 * size the moment data arrives.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  loading,
  className,
  tooltip,
  rawValue,
  format,
}: StatCardProps) {
  const iconBox = (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
      <Icon className="size-4.5" strokeWidth={2} />
    </div>
  );

  return (
    <Card className={cn('gap-3', className)}>
      <CardContent className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
              {rawValue !== undefined && format ? (
                <AnimatedNumber value={rawValue} format={format} />
              ) : (
                value
              )}
            </p>
          )}
          {trend &&
            (loading ? (
              <Skeleton className="h-4 w-28" />
            ) : (
              <p
                className={cn(
                  'flex items-center gap-1 text-xs font-medium',
                  trend.value >= 0 ? 'text-success' : 'text-destructive',
                )}
              >
                {trend.value >= 0 ? (
                  <TrendingUp className="size-3.5" />
                ) : (
                  <TrendingDown className="size-3.5" />
                )}
                {trend.value >= 0 ? '+' : ''}
                {trend.value}%
                <span className="font-normal text-muted-foreground">{trend.label}</span>
              </p>
            ))}
        </div>
        {tooltip ? (
          <Tooltip>
            <TooltipTrigger render={iconBox} />
            <TooltipContent>{tooltip}</TooltipContent>
          </Tooltip>
        ) : (
          iconBox
        )}
      </CardContent>
    </Card>
  );
}
