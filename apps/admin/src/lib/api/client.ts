import type { ApiErrorBody, ApiSuccessBody, PaginationMeta } from '@/types/api';
import { ApiError } from './errors';
import { getAccessToken, setAccessToken } from './token-store';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export type QueryValue = string | number | boolean | undefined;

interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
  /** Internal — set only on the one retry attempt after a silent refresh, so a still-401 response fails instead of looping. */
  _isRetry?: boolean;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = new URL(`${BASE_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * Coalesces concurrent refresh attempts into one in-flight request —
 * if three queries 401 at the same moment (e.g. right after an access
 * token expires), they share a single `POST /auth/refresh` instead of
 * racing three, only one of which could ever actually rotate the
 * refresh token successfully.
 */
let refreshPromise: Promise<boolean> | null = null;

async function silentRefresh(): Promise<boolean> {
  refreshPromise ??= (async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      if (!res.ok) return false;
      const json = (await res.json()) as ApiSuccessBody<{ accessToken: string }>;
      setAccessToken(json.data.accessToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export interface ApiResult<T> {
  data: T;
  meta?: PaginationMeta;
}

/**
 * The one place every backend call goes through. Always sends
 * `credentials: 'include'` — required for the httpOnly refresh-token
 * cookie (see auth-provider.tsx) even though most calls only need the
 * `Authorization` header; harmless to include on every request since
 * the cookie itself is scoped to `/api/v1/auth` by the backend.
 *
 * On a 401 from anything *other* than an `/auth/*` call, attempts one
 * silent refresh-and-retry before giving up — this is what makes a
 * stale in-memory access token (e.g. the tab was idle past its 15min
 * lifetime) invisible to the rest of the app instead of every query
 * needing its own retry logic.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<ApiResult<T>> {
  const token = getAccessToken();
  const res = await fetch(buildUrl(path, options.query), {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  const json: ApiSuccessBody<T> | ApiErrorBody | Record<string, never> = text
    ? JSON.parse(text)
    : { success: res.ok };

  if (!res.ok || (json as { success?: boolean }).success === false) {
    const isAuthEndpoint = path.startsWith('/auth/');
    if (res.status === 401 && !options._isRetry && !isAuthEndpoint) {
      const refreshed = await silentRefresh();
      if (refreshed) {
        return apiFetch<T>(path, { ...options, _isRetry: true });
      }
    }
    const errorBody = json as Partial<ApiErrorBody>;
    throw new ApiError(
      errorBody.error?.code ?? 'UNKNOWN_ERROR',
      errorBody.error?.message ?? 'Something went wrong. Please try again.',
      res.status,
      errorBody.error?.details,
    );
  }

  const successBody = json as ApiSuccessBody<T>;
  return { data: successBody.data, meta: successBody.meta };
}

/** Convenience wrapper for the common case of only needing `data`, not pagination `meta`. */
export async function apiFetchData<T>(path: string, options?: ApiFetchOptions): Promise<T> {
  const { data } = await apiFetch<T>(path, options);
  return data;
}
