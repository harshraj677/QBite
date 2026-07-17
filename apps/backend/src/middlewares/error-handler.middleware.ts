import type { ErrorRequestHandler } from 'express';

import { env } from '@config/env';
import { AppError } from '@errors/app-error';
import { logger } from '@logging/logger';

interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details: unknown;
  };
}

/**
 * The single place an error becomes an HTTP response. Registered last
 * in app.ts, after `notFound()` — Express recognizes it as an
 * error-handling middleware by its 4-argument signature.
 *
 * `AppError` instances (see errors/) map directly to their declared
 * statusCode/code/message/details. Anything else is an unanticipated
 * bug: logged with full detail always, but the client only receives a
 * generic message in production — never a stack trace or internal
 * error text, per docs/QBite_SRS_PRD.md §19 security considerations.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const code = isAppError ? err.code : 'INTERNAL_SERVER_ERROR';
  const isOperational = isAppError ? err.isOperational : false;

  const logPayload = { err, method: req.method, path: req.originalUrl };
  if (isOperational) {
    logger.warn(logPayload, 'handled request error');
  } else {
    logger.error(logPayload, 'unhandled request error');
  }

  const message =
    isOperational || env.nodeEnv !== 'production'
      ? (err as Error).message
      : 'An unexpected error occurred. Please try again later.';

  const details = isOperational && isAppError ? err.details : null;

  const body: ErrorEnvelope = { success: false, error: { code, message, details } };
  res.status(statusCode).json(body);
};
