import type { Response } from 'express';

/**
 * Response envelope helpers matching docs/API_SPECIFICATION.md §4
 * exactly. Every successful response goes through one of these two
 * functions rather than a route calling `res.json(...)` directly —
 * that's what guarantees the envelope shape never drifts between
 * modules written by different people at different times.
 */

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

interface SuccessBody<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

/** Single-resource or action response. `data` is `null` for e.g. a DELETE. */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200): Response {
  const body: SuccessBody<T> = { success: true, data };
  return res.status(statusCode).json(body);
}

/** Paginated collection response — `meta` is required, per API_SPECIFICATION.md §8. */
export function sendPaginated<T>(
  res: Response,
  data: T[],
  meta: PaginationMeta,
  statusCode = 200,
): Response {
  const body: SuccessBody<T[]> = { success: true, data, meta };
  return res.status(statusCode).json(body);
}
