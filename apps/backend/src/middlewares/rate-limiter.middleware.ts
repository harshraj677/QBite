import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';

import { env } from '@config/env';
import { TooManyRequestsError } from '@errors/http-errors';

/**
 * Rate-limiting architecture: a factory, not a single fixed policy.
 *
 * `defaultRateLimiter` (applied globally in app.ts) uses the general
 * window/max from config/env.ts. A future module builds a *stricter*
 * limiter the same way — e.g. the auth module's OTP-request endpoint
 * (per docs/QBite_SRS_PRD.md §19: "rate-limited per phone") calls
 * `createRateLimiter({ windowMs: 5 * 60_000, max: 3 })` and applies it
 * to just that route — no new architecture needed, just a call.
 */
export function createRateLimiter(options: { windowMs: number; max: number }): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(
        new TooManyRequestsError(
          'RATE_LIMIT_EXCEEDED',
          'Too many requests. Please try again later.',
        ),
      );
    },
  });
}

export const defaultRateLimiter: RequestHandler = createRateLimiter({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
});
