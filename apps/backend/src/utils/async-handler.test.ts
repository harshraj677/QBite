import type { NextFunction, Request, Response } from 'express';

import { catchAsync } from './async-handler';

describe('catchAsync', () => {
  it('calls the wrapped handler with req, res, next', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    const wrapped = catchAsync(handler);
    const req = {} as Request;
    const res = {} as Response;
    const next = jest.fn() as NextFunction;

    await wrapped(req, res, next);

    expect(handler).toHaveBeenCalledWith(req, res, next);
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards a rejected promise to next() instead of throwing', async () => {
    const error = new Error('boom');
    const handler = jest.fn().mockRejectedValue(error);
    const wrapped = catchAsync(handler);
    const req = {} as Request;
    const res = {} as Response;
    const next = jest.fn() as NextFunction;

    await wrapped(req, res, next);
    // catchAsync doesn't await the inner promise itself — give the
    // microtask queue a tick to let the .catch(next) attachment run.
    await new Promise(process.nextTick);

    expect(next).toHaveBeenCalledWith(error);
  });
});
