import { model, Schema } from 'mongoose';

import type { IVerificationOtp } from './auth.types';
import { OTP_PURPOSES } from './auth.types';

/**
 * `otpHash` is bcrypt, not the plain 6-digit code — see
 * ARCHITECTURE.md §6 for why bcrypt (not a faster hash) is still used
 * here despite the code's low entropy: it's cheap defense in depth,
 * and OTPs are additionally protected by `attempts` (capped in
 * auth.service.ts) and the TTL-backed `expiresAt`.
 */
const verificationOtpSchema = new Schema<IVerificationOtp>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  otpHash: {
    type: String,
    required: true,
  },
  purpose: {
    type: String,
    enum: OTP_PURPOSES,
    required: true,
  },
  attempts: {
    type: Number,
    default: 0,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  consumedAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

verificationOtpSchema.index({ userId: 1, purpose: 1 });
verificationOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const VerificationOtpModel = model<IVerificationOtp>(
  'VerificationOtp',
  verificationOtpSchema,
);
