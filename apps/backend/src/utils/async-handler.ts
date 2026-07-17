import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wraps an async route/middleware handler so a rejected promise is
 * forwarded to `next(err)` — and therefore reaches the centralized
 * error handler — instead of becoming an unhandled rejection.
 *
 * Usage (once a real route exists): `router.get('/orders/:id',
 * catchAsync(async (req, res) => { ... }))`. Every async handler in
 * every future module is expected to be wrapped with this; it is the
 * one piece of boilerplate a route can't avoid, by design — explicit
 * beats a monkey-patched Express internal.
 */
export function catchAsync(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
