import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import { ValidationError } from '@errors/http-errors';

import { validateRequest } from './validate-request.middleware';

function mockReq(body: Record<string, unknown>): Request {
  return { body } as unknown as Request;
}

describe('validateRequest', () => {
  it('replaces req.body with the parsed, coerced data on success', () => {
    const schema = z.object({ name: z.string(), age: z.coerce.number() });
    const middleware = validateRequest({ body: schema });
    const req = mockReq({ name: 'Ana', age: '29' });
    const next = jest.fn() as NextFunction;

    middleware(req, {} as Response, next);

    expect(req.body).toEqual({ name: 'Ana', age: 29 });
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next with a ValidationError carrying field-level details on failure', () => {
    const schema = z.object({ name: z.string(), age: z.coerce.number() });
    const middleware = validateRequest({ body: schema });
    const req = mockReq({ age: 'not-a-number' });
    const next = jest.fn() as NextFunction;

    middleware(req, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    const errorArg = (next as jest.Mock).mock.calls[0][0];
    expect(errorArg).toBeInstanceOf(ValidationError);
    expect(errorArg.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(errorArg.details)).toBe(true);
    expect(errorArg.details.length).toBeGreaterThan(0);
    expect(errorArg.details[0]).toHaveProperty('field');
    expect(errorArg.details[0]).toHaveProperty('message');
  });

  it('leaves req.body untouched when validation fails', () => {
    const schema = z.object({ name: z.string() });
    const middleware = validateRequest({ body: schema });
    const req = mockReq({});
    const next = jest.fn() as NextFunction;

    middleware(req, {} as Response, next);

    expect(req.body).toEqual({});
  });
});
