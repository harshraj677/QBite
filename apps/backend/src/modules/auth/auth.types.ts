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
