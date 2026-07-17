import type { Request } from 'express';

import { replaceRequestProperty } from './replace-request-property';

describe('replaceRequestProperty — params/body (plain data properties)', () => {
  it('mutates the existing object in place rather than replacing the reference', () => {
    const params = { a: '1', b: '2' };
    const req = { params } as unknown as Request;
    const reference = req.params;

    replaceRequestProperty(req, 'params', { c: '3' });

    expect(req.params).toBe(reference);
  });

  it('removes keys not present in the replacement', () => {
    const req = { body: { a: 1, b: 2 } } as unknown as Request;

    replaceRequestProperty(req, 'body', { c: 3 });

    expect(req.body).toEqual({ c: 3 });
  });
});

describe('replaceRequestProperty — query (Express 5 getter that re-parses on every access)', () => {
  /**
   * Regression test for a real bug: Express 5's `req.query` is a
   * getter that returns a FRESH object from the raw query string on
   * every single access — not the same cached object each time. A
   * naive in-place-mutation approach (which worked for params/body,
   * and which an earlier version of this test suite validated against
   * a getter mock that always returned the SAME backing object) does
   * NOT persist here: by the time anything reads `req.query` again,
   * the getter has already produced a brand-new object, discarding
   * whatever was mutated on the previous one.
   *
   * This shipped silently broken for a full phase — `sanitizeInput`'s
   * NoSQL-injection stripping of query params never actually reached
   * a route handler — because the only prior test checked "does the
   * request avoid crashing," not "does the downstream handler see the
   * replaced value." This test checks the latter.
   */
  function makeReqWithFreshQueryEachAccess(initial: Record<string, unknown>): Request {
    let callCount = 0;
    return {
      get query() {
        callCount += 1;
        // A NEW object every access — simulates Express 5's real
        // re-parse-from-querystring behavior, unlike a memoized mock.
        return { ...initial, _accessCount: callCount };
      },
    } as unknown as Request;
  }

  it('persists the replacement across multiple subsequent reads of req.query', () => {
    const req = makeReqWithFreshQueryEachAccess({ role: 'admin' });

    replaceRequestProperty(req, 'query', { page: 1, limit: 20 });

    // Two separate reads, as a middleware chain would produce —
    // both must see the replaced value, not a re-parsed original.
    expect(req.query).toEqual({ page: 1, limit: 20 });
    expect(req.query).toEqual({ page: 1, limit: 20 });
  });

  it('does not throw "Cannot set property query ... which has only a getter"', () => {
    const req = makeReqWithFreshQueryEachAccess({});

    expect(() => replaceRequestProperty(req, 'query', { ok: true })).not.toThrow();
  });
});
