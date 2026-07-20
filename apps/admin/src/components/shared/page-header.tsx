import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Buttons/menus rendered on the trailing edge — right-aligned on desktop, wraps below the title on mobile rather than overflowing. */
  actions?: ReactNode;
  className?: string;
}

/**
 * The one page-title pattern used across every screen in the app —
 * see docs/DESIGN_SYSTEM.md's typography scale for why `text-2xl
 * font-semibold tracking-tight` specifically is "the" page-title
 * style, not a per-page choice.
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance text-foreground">
          {title}
        </h1>
        {description && <p className="text-sm text-muted-foreground text-pretty">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
