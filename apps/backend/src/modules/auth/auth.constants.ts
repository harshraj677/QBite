/**
 * Auth-domain behavioral constants. Unlike config/env.ts, these don't
 * vary per deployment environment — they're security-policy decisions,
 * not secrets or infrastructure endpoints, so they're named constants
 * rather than environment variables (avoiding both magic numbers and
 * unnecessary env surface).
 */

// Password hashing — see ARCHITECTURE.md §6 for why passwords and
// OTPs use bcrypt while high-entropy tokens use SHA-256.
export const PASSWORD_BCRYPT_ROUNDS = 12;
export const OTP_BCRYPT_ROUNDS = 10;

// Password strength policy, enforced in auth.validation.ts.
export const PASSWORD_MIN_LENGTH = 8;

// Email verification OTP.
export const OTP_LENGTH = 6;
export const OTP_EXPIRY_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;

// Password reset.
export const PASSWORD_RESET_TOKEN_EXPIRY_MINUTES = 30;

// Account lockout — independent of, and in addition to, the IP-based
// rate limits in auth.rate-limits.ts.
export const ACCOUNT_LOCK_THRESHOLD = 5;
export const ACCOUNT_LOCK_DURATION_MINUTES = 15;

// Refresh token cookie (web clients only — mobile uses the JSON body;
// see ARCHITECTURE.md §4.3).
export const REFRESH_TOKEN_COOKIE_NAME = 'qbite_refresh_token';
