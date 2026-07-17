import type { Document, Types } from 'mongoose';

import type { UserRole } from '@modules/users/user.types';

// ─── RefreshToken ────────────────────────────────────────────────
export interface IRefreshToken extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt?: Date;
  replacedByTokenHash?: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: Date;
}

// ─── VerificationOTP ─────────────────────────────────────────────
export const OTP_PURPOSES = ['email_verification'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

export interface IVerificationOtp extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  otpHash: string;
  purpose: OtpPurpose;
  attempts: number;
  expiresAt: Date;
  consumedAt?: Date;
  createdAt: Date;
}

// ─── PasswordResetToken ──────────────────────────────────────────
export interface IPasswordResetToken extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  consumedAt?: Date;
  createdAt: Date;
}

// ─── AuditLog ────────────────────────────────────────────────────
/**
 * Every security-relevant event this module can produce. Kept as a
 * closed set (not a free-form string) so a typo can't silently create
 * an untracked, unqueryable action name.
 */
export const AUDIT_ACTIONS = [
  'auth.register',
  'auth.email.verified',
  'auth.email.verification_failed',
  'auth.login.success',
  'auth.login.failure',
  'auth.logout',
  'auth.token.refreshed',
  'auth.token.reuse_detected',
  'auth.account.locked',
  'auth.password.reset_requested',
  'auth.password.reset_completed',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  actorId?: Types.ObjectId;
  actorRole?: UserRole;
  action: AuditAction;
  success: boolean;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

// ─── DTOs ────────────────────────────────────────────────────────
export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
  /** Access token lifetime in seconds, per API_SPECIFICATION.md conventions — clients shouldn't parse the JWT to know when to refresh. */
  expiresIn: number;
}

export interface JwtAccessPayload {
  sub: string;
  role: UserRole;
}
