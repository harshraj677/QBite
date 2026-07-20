import { UtensilsCrossed } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  /** Renders only the mark (no wordmark) — the collapsed sidebar rail, the auth page's compact header, etc. */
  iconOnly?: boolean;
}

/**
 * The one brand mark in the app — every other place that needs "QBite"
 * visually (sidebar header, auth screens, browser tab via
 * app/favicon.ico) renders this, not a copy-pasted div, so a future
 * brand refresh is a one-file change.
 */
export function Logo({ className, iconOnly = false }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <UtensilsCrossed className="size-4" strokeWidth={2.25} />
      </div>
      {!iconOnly && (
        <span className="text-sm font-semibold tracking-tight text-foreground">
          QBite <span className="font-normal text-muted-foreground">Admin</span>
        </span>
      )}
    </div>
  );
}
