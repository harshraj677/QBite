import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express, type Request } from 'express';

import { env } from '@config/env';
import { mountApiDocs } from '@config/swagger';
import { healthRouter } from '@health/health.routes';
import { errorHandler } from '@middlewares/error-handler.middleware';
import { notFound } from '@middlewares/not-found.middleware';
import { defaultRateLimiter } from '@middlewares/rate-limiter.middleware';
import { requestId } from '@middlewares/request-id.middleware';
import { requestLogger } from '@middlewares/request-logger.middleware';
import { sanitizeInput, securityHeaders } from '@middlewares/security.middleware';
import { v1Router } from '@api/v1';

/**
 * Express application shell — global middleware pipeline only.
 *
 * Order matters and is deliberate:
 *   1. requestId — must run first; everything after it (logging, the
 *      error handler) depends on the request context it establishes.
 *   2. requestLogger — wraps the entire request lifecycle so even a
 *      failure in step 3+ is still logged with its final status code.
 *   3. securityHeaders (helmet/hpp) + cors — reject/reshape before any
 *      body parsing or business logic sees the request.
 *   4. defaultRateLimiter — global baseline; stricter per-route limits
 *      (e.g. OTP request) are added by that route once it exists, via
 *      middlewares/rate-limiter.middleware.ts's `createRateLimiter`.
 *   5. compression, cookies, body parsing.
 *   6. sanitizeInput — NoSQL-injection guard; runs *after* body
 *      parsing because it also sanitizes `req.body`, which doesn't
 *      exist before step 5.
 *   7. Mounts: /health (unversioned ops endpoint), /api-docs (Swagger
 *      UI), /api/v1 (empty — future modules register here).
 *   8. notFound, then errorHandler — must be registered last, in that
 *      order, per Express's error-middleware convention.
 *
 * No feature routes, controllers, or business logic are registered
 * here. Auth/RBAC/validation are a *per-route* concern layered on top
 * of this global chain by each module as it's built (see
 * validation/validate-request.middleware.ts) — they are not part of
 * this global pipeline.
 *
 * **One addition, added for the Payments phase, strictly required for
 * integration:** `express.json()`'s `verify` callback captures the
 * exact raw request bytes onto `req.rawBody` (see
 * `modules/payments/raw-body.types.ts` for the `Request` type
 * augmentation) — needed because Razorpay webhook signature
 * verification is an HMAC over the literal bytes Razorpay sent, and
 * `JSON.stringify(req.body)` is not guaranteed to reproduce those
 * bytes exactly. This runs for every request, on every route, but is
 * a pure side-effect capture with no behavioral change to normal JSON
 * parsing — `req.body` is populated identically to before for every
 * route that doesn't read `req.rawBody`, which is every route except
 * `POST /payments/webhook`. The full pre-existing test suite (587
 * tests as of the previous phase, all exercising this exact global
 * middleware chain via real HTTP requests) passing unchanged is the
 * regression proof for that.
 */
export function createApp(): Express {
  const app = express();

  app.use(requestId());
  app.use(requestLogger());

  app.use(securityHeaders());
  app.use(cors({ origin: env.corsOrigin, credentials: true }));

  app.use(defaultRateLimiter);

  app.use(compression());
  app.use(cookieParser());
  app.use(
    express.json({
      // `req` here is typed as plain `http.IncomingMessage` by
      // body-parser's types (not Express's augmented `Request`), even
      // though it's the same object at runtime — the cast is only for
      // the type checker.
      verify: (req, _res, buf) => {
        (req as Request).rawBody = Buffer.from(buf);
      },
    }),
  );
  app.use(express.urlencoded({ extended: true }));

  app.use(sanitizeInput());

  app.use('/health', healthRouter);
  mountApiDocs(app);
  app.use('/api/v1', v1Router);

  app.use(notFound());
  app.use(errorHandler);

  return app;
}
