import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';

import { env } from '@config/env';
import { TooManyRequestsError } from '@errors/http-errors';

/**
 * Rate-limiting architecture: a factory, not a single fixed policy.
 *
 * `defaultRateLimiter` (applied globally in app.ts) uses the general
 * window/max from config/env.ts. A future module builds a *stricter*
 * limiter the same way — e.g. the auth module's login/register/OTP
 * endpoints (per docs/QBite_SRS_PRD.md §19: "rate-limited per phone")
 * call `createRateLimiter({ windowMs: 5 * 60_000, max: 3 })` and apply
 * it to just that route — no new architecture needed, just a call.
 *
 * `skip` under `NODE_ENV=test`: integration tests exercise a single
 * endpoint's full range of scenarios (success, wrong password,
 * lockout, ...) many times in one run, all from the same loopback
 * "IP" — real rate limiting would make the test suite's *volume* of
 * requests the failure mode being tested, not the business logic
 * under test. Rate limiting's own mechanics are the well-tested
 * responsibility of `express-rate-limit`; what this project adds
 * (the windowMs/max policy, the TooManyRequestsError mapping) is
 * covered by a direct unit test instead. Never skipped outside `test`.
 */
export function createRateLimiter(options: { windowMs: number; max: number }): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => env.nodeEnv === 'test',
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
