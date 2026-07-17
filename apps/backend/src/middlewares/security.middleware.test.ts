import type { NextFunction, Request, Response } from 'express';

import { sanitizeInput } from './security.middleware';

/**
 * Regression coverage for the bug documented in
 * utils/replace-request-property.ts: `sanitizeInput` mutating
 * `req.query` did nothing observable to a downstream reader, because
 * Express 5's `req.query` getter re-parses fresh on every access.
 * `security.integration.test.ts` only ever checked "the request
 * doesn't 500," which stayed green throughout — this test checks the
 * thing that was actually broken: does a handler reading `req.query`
 * *after* this middleware ran see the sanitized value.
 */
function makeReqWithFreshQueryEachAccess(rawQuery: Record<string, unknown>): Request {
  return {
    get query() {
      return { ...rawQuery }; // a NEW object every access, like real Express 5
    },
    params: { ...rawQuery },
    body: undefined,
  } as unknown as Request;
}

describe('sanitizeInput', () => {
  it('strips $-prefixed keys from req.query and the strip is visible on a later read', () => {
    const req = makeReqWithFreshQueryEachAccess({ role: 'admin', $where: '1' });
    const next = jest.fn() as NextFunction;

    sanitizeInput()(req, {} as Response, next);

    expect(req.query).toEqual({ role: 'admin' });
    expect(next).toHaveBeenCalledWith();
  });

  it('strips dotted keys from req.query', () => {
    const req = makeReqWithFreshQueryEachAccess({ 'role.admin': 'true', safe: 'ok' });
    const next = jest.fn() as NextFunction;

    sanitizeInput()(req, {} as Response, next);

    expect(req.query).toEqual({ safe: 'ok' });
  });

  it('sanitizes req.body in place (plain data property — no getter quirk)', () => {
    const req = {
      query: {},
      params: {},
      body: { $set: { role: 'admin' }, name: 'ok' },
    } as unknown as Request;
    const next = jest.fn() as NextFunction;

    sanitizeInput()(req, {} as Response, next);

    expect(req.body).toEqual({ name: 'ok' });
  });
});
