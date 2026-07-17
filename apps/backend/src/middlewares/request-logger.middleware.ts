import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { logger } from '@logging/logger';

/**
 * Structured access logging — the JSON-with-request-ID replacement for
 * `morgan`'s plain-text access log (see ARCHITECTURE.md §3.2 for why
 * morgan was removed). Logs once when the request completes (not on
 * entry) so the log line carries the final status code and duration in
 * a single, greppable event rather than two.
 */
export function requestLogger(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const startedAt = process.hrtime.bigint();

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      logger.info(
        {
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          durationMs: Math.round(durationMs * 100) / 100,
        },
        'request completed',
      );
    });

    next();
  };
}
