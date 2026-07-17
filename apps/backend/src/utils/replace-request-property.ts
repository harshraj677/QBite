import type { Request } from 'express';

/**
 * Replaces the *effective contents* of `req.query`, `req.params`, or
 * `req.body` with `next` — the one place Express 5's `req.query`
 * quirks are handled, so callers (`middlewares/security.middleware.ts`,
 * `validation/validate-request.middleware.ts`) don't need to know
 * about them.
 *
 * `req.params` and `req.body` are plain data properties, so mutating
 * the existing object's own keys in place is sufficient.
 *
 * `req.query` is different in a way that bit this project twice:
 * Express 5 defines it as a **getter that re-parses the raw query
 * string on every access** — it does NOT return the same cached
 * object each time. Mutating "the object the getter just returned" is
 * therefore silently discarded the moment anything reads `req.query`
 * again (the next read re-invokes the getter and gets a fresh,
 * un-mutated parse). This was true for `sanitizeInput`'s NoSQL-
 * injection stripping since the day it was written — the stripped
 * value never actually reached a route handler — and was only caught
 * once a real endpoint (`GET /canteens`) needed to *read* a validated
 * query param back and got the raw, un-defaulted value instead. The
 * existing test for both call sites only checked "the request doesn't
 * crash," not "the downstream handler sees the replaced value," which
 * is how this shipped unnoticed.
 *
 * The fix: for `query` specifically, shadow the getter with a plain
 * value property on this request instance via `Object.defineProperty`
 * — a per-request override, not a change to Express's prototype.
 */
export function replaceRequestProperty(
  req: Request,
  key: 'query' | 'params' | 'body',
  next: Record<string, unknown>,
): void {
  if (key === 'query') {
    Object.defineProperty(req, 'query', {
      value: next,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    return;
  }

  const target = req[key] as Record<string, unknown>;
  for (const existingKey of Object.keys(target)) {
    delete target[existingKey];
  }
  Object.assign(target, next);
}
