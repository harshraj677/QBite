import { AppError } from './app-error';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
  UnprocessableEntityError,
  ValidationError,
} from './http-errors';

describe('http-errors', () => {
  it.each([
    [BadRequestError, 400],
    [UnauthorizedError, 401],
    [ForbiddenError, 403],
    [NotFoundError, 404],
    [ConflictError, 409],
    [UnprocessableEntityError, 422],
    [TooManyRequestsError, 429],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table-driven test over classes with differing constructor signatures
  ])('%p maps to status %i and is an AppError', (ErrorClass: any, expectedStatus: number) => {
    const error = new ErrorClass('SOME_CODE', 'some message', { field: 'x' });

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(expectedStatus);
    expect(error.code).toBe('SOME_CODE');
    expect(error.message).toBe('some message');
    expect(error.details).toEqual({ field: 'x' });
    expect(error.isOperational).toBe(true);
  });

  it('ValidationError always uses the VALIDATION_ERROR code', () => {
    const error = new ValidationError('invalid body', [{ field: 'email', message: 'required' }]);

    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toEqual([{ field: 'email', message: 'required' }]);
  });

  it('InternalServerError is 500, INTERNAL_SERVER_ERROR, and non-operational', () => {
    const error = new InternalServerError();

    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(error.isOperational).toBe(false);
  });
});
