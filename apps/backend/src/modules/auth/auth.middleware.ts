import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { TokenExpiredError } from 'jsonwebtoken';

import { ForbiddenError, UnauthorizedError } from '@errors/http-errors';
import { UsersService } from '@modules/users/users.service';
import type { UserRole } from '@modules/users/user.types';
import { verifyAccessToken } from './token.util';

/**
 * Auth's intentional public middleware surface — imported by other
 * modules the same way they'd import a service, per ARCHITECTURE.md
 * §3.1's module boundary rule. This is where a future orders/reviews/
 * etc. module gets `authenticate`/`requireRole` from; none of them
 * verify a JWT themselves.
 */

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  collegeEmail: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser;
  }
}

const usersService = new UsersService();

/**
 * Verifies the access token and re-fetches the user from MongoDB on
 * every request — not just trusting the JWT payload. This is what
 * makes a role change or account deactivation take effect immediately
 * (within one request), and what lets `passwordChangedAt` invalidate
 * outstanding access tokens without a token blacklist (see
 * ARCHITECTURE.md §6).
 */
export function authenticate(): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.header('Authorization');
    if (!header?.startsWith('Bearer ')) {
      return next(new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.'));
    }
    const rawToken = header.slice('Bearer '.length);

    let payload;
    try {
      payload = verifyAccessToken(rawToken);
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        return next(new UnauthorizedError('AUTH_TOKEN_EXPIRED', 'Access token has expired.'));
      }
      return next(new UnauthorizedError('AUTH_TOKEN_INVALID', 'Invalid access token.'));
    }

    const user = await usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      return next(
        new UnauthorizedError('AUTH_USER_NOT_FOUND', 'Account no longer exists or is disabled.'),
      );
    }

    if (user.passwordChangedAt && payload.iat * 1000 < user.passwordChangedAt.getTime()) {
      return next(
        new UnauthorizedError(
          'AUTH_TOKEN_STALE',
          'Password has changed since this token was issued. Please log in again.',
        ),
      );
    }

    req.user = { id: user._id.toString(), role: user.role, collegeEmail: user.collegeEmail };
    next();
  };
}

/** Must run after `authenticate()`. */
export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.'));
    }
    if (!roles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          'INSUFFICIENT_PERMISSIONS',
          'You do not have permission to perform this action.',
        ),
      );
    }
    next();
  };
}
