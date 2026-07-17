/**
 * Replaces the *contents* of a request property (`req.query`,
 * `req.params`, `req.body`) in place, rather than reassigning the
 * property itself.
 *
 * Express 5 defines `req.query` as a getter with no setter — `req.query
 * = x` throws `Cannot set property query of #<IncomingMessage> which
 * has only a getter`. The getter still returns a live, mutable object
 * reference each time, though, so clearing its own keys and copying
 * the new values into that same object achieves the same effect
 * without touching the property binding itself. Used by both
 * `middlewares/security.middleware.ts` (sanitization) and
 * `validation/validate-request.middleware.ts` (schema-parsed
 * replacement) — the one place this Express 5 quirk is handled, so
 * neither call site needs to know about it.
 */
export function replaceRequestProperty(target: object, next: Record<string, unknown>): void {
  for (const key of Object.keys(target)) {
    delete (target as Record<string, unknown>)[key];
  }
  Object.assign(target, next);
}
