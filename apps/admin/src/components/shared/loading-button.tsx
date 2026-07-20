import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface LoadingButtonProps extends ComponentProps<typeof Button> {
  loading?: boolean;
  /** Shown instead of `children` while `loading` — defaults to reusing `children` so callers don't have to repeat "Save"/"Saving…" unless the copy should actually change. */
  loadingText?: React.ReactNode;
}

/**
 * Every form-submit button in the app is this, not a bare `<Button>`
 * with ad-hoc `disabled={isPending}` — one place owns "what a pending
 * async action looks like" (spinner + disabled + no layout shift).
 */
export function LoadingButton({
  loading = false,
  loadingText,
  children,
  disabled,
  ...props
}: LoadingButtonProps) {
  return (
    <Button disabled={disabled || loading} {...props}>
      {loading && <Spinner />}
      {loading ? (loadingText ?? children) : children}
    </Button>
  );
}
