import { AppError } from './app-error';

describe('AppError', () => {
  it('exposes statusCode, code, message, and details', () => {
    const error = new AppError(418, 'IM_A_TEAPOT', 'short and stout', { handle: true });

    expect(error.statusCode).toBe(418);
    expect(error.code).toBe('IM_A_TEAPOT');
    expect(error.message).toBe('short and stout');
    expect(error.details).toEqual({ handle: true });
  });

  it('defaults details to null and isOperational to true', () => {
    const error = new AppError(400, 'BAD', 'bad request');

    expect(error.details).toBeNull();
    expect(error.isOperational).toBe(true);
  });

  it('is a real Error with a name matching its constructor', () => {
    const error = new AppError(500, 'BOOM', 'boom');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('AppError');
    expect(error.stack).toBeDefined();
  });
});
