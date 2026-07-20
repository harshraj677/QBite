'use client';

import { RefreshCw, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QueryErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void | Promise<unknown>;
  className?: string;
}

/**
 * The one "something failed to load" pattern for every widget on the
 * dashboard — a friendly message plus a real retry action, never a
 * bare error string. `onRetry` is typically a TanStack Query
 * `refetch`; this tracks its own pending state locally so callers
 * don't each need to wire up a spinner.
 */
export function QueryErrorState({
  title = "Couldn't load this data",
  description = 'Something went wrong on our end. Try again in a moment.',
  onRetry,
  className,
}: QueryErrorStateProps) {
  const [retrying, setRetrying] = useState(false);

  async function handleRetry() {
    if (!onRetry) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl px-6 py-12 text-center',
        className,
      )}
    >
      <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <WifiOff className="size-5" strokeWidth={1.75} />
      </div>
      <div className="max-w-xs space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-sm text-balance text-muted-foreground">{description}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={handleRetry} disabled={retrying}>
          <RefreshCw className={cn('size-3.5', retrying && 'animate-spin')} />
          Try again
        </Button>
      )}
    </div>
  );
}
