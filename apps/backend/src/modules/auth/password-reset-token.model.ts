import { model, Schema } from 'mongoose';

import type { IPasswordResetToken } from './auth.types';

/**
 * `tokenHash` is SHA-256, not bcrypt — the raw token is a 256-bit
 * `crypto.randomBytes` value (see token.util.ts), high enough entropy
 * that a slow hash buys no additional brute-force resistance. See
 * ARCHITECTURE.md §6.
 */
const passwordResetTokenSchema = new Schema<IPasswordResetToken>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  tokenHash: {
    type: String,
    required: true,
    unique: true,
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

passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordResetTokenModel = model<IPasswordResetToken>(
  'PasswordResetToken',
  passwordResetTokenSchema,
);
