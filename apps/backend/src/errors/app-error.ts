/**
 * Base class for every error the API deliberately throws.
 *
 * Maps 1:1 onto the error envelope in docs/API_SPECIFICATION.md §5:
 * `code` is the stable, machine-readable identifier clients branch on;
 * `message` is the human-readable string; `details` is optional
 * structured context (e.g. field-level validation errors).
 *
 * `isOperational: true` distinguishes "an error we anticipated and
 * handled deliberately" (bad input, not found, etc.) from a genuine
 * bug — the centralized error handler (see
 * middlewares/error-handler.middleware.ts) uses this flag to decide
 * whether it's safe to expose `message`/`details` to the client, or
 * whether to return a generic message and rely on the logged stack
 * trace instead.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details: unknown = null,
    public readonly isOperational: boolean = true,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}
