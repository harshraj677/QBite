import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { NotFoundError } from '@errors/http-errors';

/**
 * Catches any request that reached this point without a route
 * matching it. Registered last, after every module router (see
 * app.ts) — turns Express's default HTML 404 into the standard JSON
 * error envelope via the centralized error handler.
 */
export function notFound(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    next(
      new NotFoundError('ROUTE_NOT_FOUND', `No route matches ${req.method} ${req.originalUrl}.`),
    );
  };
}
