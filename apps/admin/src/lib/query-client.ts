import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api/errors';

/**
 * One factory, called once per browser tab (see providers/query-provider.tsx's
 * `useState(() => makeQueryClient())`) — never a module-level singleton,
 * which would leak cached data across users/sessions under SSR.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // A 401/403 won't succeed on retry — apiFetch already tried
          // one silent refresh internally before this error ever
          // surfaces here, so retrying again is pure noise.
          if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
            return false;
          }
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}
