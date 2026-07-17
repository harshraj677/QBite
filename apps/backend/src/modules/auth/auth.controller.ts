import type { CookieOptions, Request } from 'express';

import { env } from '@config/env';
import { BadRequestError, UnauthorizedError } from '@errors/http-errors';
import { sendSuccess } from '@response/api-response';
import { catchAsync } from '@utils/async-handler';
import { REFRESH_TOKEN_COOKIE_NAME } from './auth.constants';
import type { RequestMeta } from './auth.service';
import { AuthService } from './auth.service';
import type {
  ForgotPasswordInput,
  LoginInput,
  LogoutInput,
  RefreshInput,
  RegisterInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from './auth.validation';
import { parseDurationToMs } from './token.util';

function extractMeta(req: Request): RequestMeta {
  return { ipAddress: req.ip, userAgent: req.header('User-Agent') };
}

/**
 * Scoped to `/api/v1/auth` (not the whole site) so the cookie isn't
 * sent on every unrelated API call — it's only needed by the two
 * endpoints that read it (refresh, logout). `sameSite: 'none'`
 * requires `secure: true` in every browser; that pairing only applies
 * in production (real HTTPS) — see ARCHITECTURE.md §4.3.
 */
function refreshTokenCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.nodeEnv !== 'development',
    sameSite: env.nodeEnv === 'production' ? 'none' : 'lax',
    path: '/api/v1/auth',
    maxAge: parseDurationToMs(env.jwt.refreshExpiry),
  };
}

function extractRefreshToken(req: Request, bodyToken: string | undefined): string | undefined {
  // Cookie takes precedence — a web client that has both a cookie and
  // (accidentally) a stale body value should use the cookie.
  const cookieToken = (req.cookies as Record<string, string> | undefined)?.[
    REFRESH_TOKEN_COOKIE_NAME
  ];
  return cookieToken ?? bodyToken;
}

/** Every handler is `catchAsync`-wrapped and does nothing beyond: parse request, call the service, shape the response. Business logic lives entirely in AuthService. */
export class AuthController {
  constructor(private readonly authService: AuthService = new AuthService()) {}

  register = catchAsync(async (req, res) => {
    const user = await this.authService.register(req.body as RegisterInput, extractMeta(req));
    sendSuccess(res, { user }, 201);
  });

  verifyEmail = catchAsync(async (req, res) => {
    const user = await this.authService.verifyEmail(req.body as VerifyEmailInput, extractMeta(req));
    sendSuccess(res, { user });
  });

  login = catchAsync(async (req, res) => {
    const { user, accessToken, refreshToken, expiresIn } = await this.authService.login(
      req.body as LoginInput,
      extractMeta(req),
    );
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, refreshTokenCookieOptions());
    sendSuccess(res, { user, accessToken, refreshToken, expiresIn });
  });

  refresh = catchAsync(async (req, res) => {
    const rawToken = extractRefreshToken(req, (req.body as RefreshInput).refreshToken);
    if (!rawToken) {
      throw new BadRequestError('REFRESH_TOKEN_MISSING', 'Refresh token is required.');
    }

    const tokens = await this.authService.refresh(rawToken, extractMeta(req));
    res.cookie(REFRESH_TOKEN_COOKIE_NAME, tokens.refreshToken, refreshTokenCookieOptions());
    sendSuccess(res, tokens);
  });

  logout = catchAsync(async (req, res) => {
    const rawToken = extractRefreshToken(req, (req.body as LogoutInput).refreshToken);
    await this.authService.logout(rawToken, extractMeta(req));
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, { path: '/api/v1/auth' });
    sendSuccess(res, null);
  });

  forgotPassword = catchAsync(async (req, res) => {
    await this.authService.forgotPassword(req.body as ForgotPasswordInput, extractMeta(req));
    sendSuccess(res, {
      message: 'If an account exists for this email, a password reset code has been sent.',
    });
  });

  resetPassword = catchAsync(async (req, res) => {
    await this.authService.resetPassword(req.body as ResetPasswordInput, extractMeta(req));
    sendSuccess(res, { message: 'Password has been reset successfully.' });
  });

  me = catchAsync(async (req, res) => {
    if (!req.user) {
      throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required.');
    }
    const user = await this.authService.me(req.user.id);
    sendSuccess(res, { user });
  });
}
