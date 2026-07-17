import helmet from 'helmet';
import hpp from 'hpp';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { replaceRequestProperty } from '@utils/replace-request-property';

/**
 * Security hardening middleware, per docs/QBite_SRS_PRD.md §19 and
 * ARCHITECTURE.md §9.7 ("security by default, not by addition").
 *
 * - helmet: standard secure-header set (HSTS, no-sniff, frame-deny, ...).
 * - hpp: rejects HTTP Parameter Pollution (`?role=admin&role=customer`
 *   style duplicate-key attacks against query parsing).
 *
 * `securityHeaders()` is applied globally, before body parsing (see
 * app.ts) — neither helmet nor hpp touch `req.body`.
 */
export function securityHeaders(): RequestHandler[] {
  return [
    helmet({
      contentSecurityPolicy: { useDefaults: true },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
    hpp(),
  ];
}

const DANGEROUS_KEY_PATTERN = /^\$|\./;

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (DANGEROUS_KEY_PATTERN.test(key)) continue;
      result[key] = sanitizeValue(val);
    }
    return result;
  }
  return value;
}

/**
 * NoSQL-injection guard: strips any object key starting with `$` or
 * containing `.` from `req.body`/`req.query`/`req.params` — the
 * standard shape of a MongoDB operator-injection payload (e.g.
 * `{"$gt": ""}` to bypass an equality check), directly relevant since
 * MongoDB is the datastore.
 *
 * A hand-rolled ~20-line middleware rather than the widely-used
 * `express-mongo-sanitize` package: that package reassigns `req.query`
 * wholesale, which throws under Express 5 ("Cannot set property query
 * of #<IncomingMessage> which has only a getter") — confirmed by
 * running it. `replaceRequestProperty` handles the correct replacement
 * strategy per property (`query` needs `Object.defineProperty`, not
 * in-place mutation — see that file's docstring for why, and for a
 * real bug this project shipped before that distinction was made),
 * and has no dependency on a package with an unresolved Express 5
 * incompatibility.
 *
 * Applied after body parsing (see app.ts) — `req.body` doesn't exist
 * until then.
 */
export function sanitizeInput(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    replaceRequestProperty(req, 'query', sanitizeValue(req.query) as Record<string, unknown>);
    replaceRequestProperty(req, 'params', sanitizeValue(req.params) as Record<string, unknown>);
    if (req.body && typeof req.body === 'object') {
      replaceRequestProperty(req, 'body', sanitizeValue(req.body) as Record<string, unknown>);
    }
    next();
  };
}
