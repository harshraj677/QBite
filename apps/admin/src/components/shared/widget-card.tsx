import { Inbox, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { EmptyState } from './empty-state';
import { QueryErrorState } from './query-error-state';

interface WidgetCardProps {
  title: string;
  description?: string;
  /** Header-trailing controls — a period switcher, a "View all" link, etc. */
  actions?: ReactNode;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void | Promise<unknown>;
  isEmpty?: boolean;
  emptyIcon?: LucideIcon;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Tailwind height utility applied to the loading skeleton and the empty/error states, so a widget never visibly resizes between its four states. */
  contentHeight?: string;
  className?: string;
  children: ReactNode;
}

/**
 * The one card shell every query-backed dashboard widget uses —
 * charts, tables, the activity timeline, kitchen status. Owns the
 * loading-skeleton / error-retry / empty / real-content branching once
 * so no individual widget re-implements it. See
 * components/shared/empty-state.tsx and query-error-state.tsx for the
 * two non-trivial states this composes.
 */
export function WidgetCard({
  title,
  description,
  actions,
  isLoading,
  isError,
  onRetry,
  isEmpty,
  emptyIcon,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  contentHeight = 'h-80',
  className,
  children,
}: WidgetCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        {actions && <CardAction>{actions}</CardAction>}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className={cn('w-full', contentHeight)} />
        ) : isError ? (
          <div className={cn('flex items-center justify-center', contentHeight)}>
            <QueryErrorState onRetry={onRetry} />
          </div>
        ) : isEmpty ? (
          <div className={cn('flex items-center justify-center', contentHeight)}>
            <EmptyState
              icon={emptyIcon ?? Inbox}
              title={emptyTitle}
              description={emptyDescription}
              className="border-none p-0"
            />
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
