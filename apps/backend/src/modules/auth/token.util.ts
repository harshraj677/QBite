import { createHash, randomBytes, randomUUID } from 'node:crypto';

import jwt from 'jsonwebtoken';

import { env } from '@config/env';
import type { JwtAccessPayload } from './auth.types';

/**
 * Opaque, high-entropy token generator — used for refresh tokens and
 * password-reset tokens (not JWTs; see ARCHITECTURE.md §6 for why).
 * 256 bits of `crypto.randomBytes`, hex-encoded.
 */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * SHA-256 of an opaque token, for DB storage — the raw token is never
 * persisted, only its hash (so a database leak doesn't hand out
 * directly-usable refresh/reset tokens).
 */
export function hashOpaqueToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export function signAccessToken(payload: JwtAccessPayload): { token: string; expiresIn: number } {
  // `jwtid`: HMAC signing is deterministic — without a unique claim,
  // two tokens signed for the same user within the same second
  // (iat has 1s granularity) would be byte-for-byte identical. A
  // random jti also gives each individual token a stable identifier
  // for log correlation, independent of this uniqueness concern.
  const token = jwt.sign(payload, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiry,
    jwtid: randomUUID(),
  } as jwt.SignOptions);

  // Decode what was just signed rather than hand-parsing the '15m'
  // style expiry string ourselves (which would mean adding a
  // dependency like `ms` just to parse the same format
  // jsonwebtoken already parses internally).
  const decoded = jwt.decode(token) as { iat: number; exp: number };
  return { token, expiresIn: decoded.exp - decoded.iat };
}

/** Throws (jwt.JsonWebTokenError / jwt.TokenExpiredError) on an invalid or expired token — callers map this to UnauthorizedError. */
export function verifyAccessToken(token: string): JwtAccessPayload & { iat: number; exp: number } {
  return jwt.verify(token, env.jwt.accessSecret) as JwtAccessPayload & { iat: number; exp: number };
}

const DURATION_PATTERN = /^(\d+)(s|m|h|d)$/;
const UNIT_TO_MS: Record<string, number> = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/**
 * Parses a simple `<number><unit>` duration string (e.g. `'30d'`,
 * `'15m'`) into milliseconds — used to compute a refresh token's
 * `expiresAt` from `JWT_REFRESH_EXPIRY`. A ~10-line parser rather than
 * adding the `ms` package: the format this project actually uses
 * (env.ts's JWT_ACCESS_EXPIRY/JWT_REFRESH_EXPIRY) is this narrow.
 */
export function parseDurationToMs(duration: string): number {
  const match = DURATION_PATTERN.exec(duration);
  if (!match) {
    throw new Error(`Invalid duration format: "${duration}" (expected e.g. "30d", "15m")`);
  }
  const [, amount, unit] = match;
  return Number(amount) * UNIT_TO_MS[unit];
}
