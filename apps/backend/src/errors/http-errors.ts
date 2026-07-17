import { AppError } from './app-error';

/**
 * One subclass per HTTP-status/error-code pairing already documented
 * in docs/API_SPECIFICATION.md §5.1. A future module throws these
 * directly — e.g. `throw new NotFoundError('ORDER_NOT_FOUND', 'Order
 * not found.')` — and the centralized error handler does the rest.
 * `code` is required on every subclass (no default) so a thrown error
 * always carries a specific, greppable identifier rather than a vague
 * generic one — see API_SPECIFICATION.md §5.2 on error-code namespacing.
 */

export class BadRequestError extends AppError {
  constructor(code: string, message: string, details: unknown = null) {
    super(400, code, message, details);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details: unknown = null) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(code: string, message: string, details: unknown = null) {
    super(401, code, message, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(code: string, message: string, details: unknown = null) {
    super(403, code, message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(code: string, message: string, details: unknown = null) {
    super(404, code, message, details);
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string, details: unknown = null) {
    super(409, code, message, details);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(code: string, message: string, details: unknown = null) {
    super(422, code, message, details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(code: string, message: string, details: unknown = null) {
    super(429, code, message, details);
  }
}

/**
 * For unexpected failures a route/service deliberately wants to
 * surface as a controlled 500 rather than letting an unknown
 * exception fall through to the handler's generic-error branch.
 * `isOperational: false` — same treatment as a genuine bug.
 */
export class InternalServerError extends AppError {
  constructor(message = 'An unexpected error occurred.', details: unknown = null) {
    super(500, 'INTERNAL_SERVER_ERROR', message, details, false);
  }
}
