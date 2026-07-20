/**
 * Mirrors apps/backend/src/response/api-response.ts and
 * middlewares/error-handler.middleware.ts exactly — every endpoint in
 * the backend responds in one of these two envelope shapes, never a
 * bare payload. Keep in sync with the backend if either ever changes.
 */

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ApiSuccessBody<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details: unknown;
  };
}
