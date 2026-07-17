import { model, Schema } from 'mongoose';

import type { IRefreshToken } from './auth.types';

/**
 * Only `tokenHash` (SHA-256 of the raw opaque token) is ever stored —
 * see token.util.ts for why a refresh token is an opaque random
 * string, not a JWT. `familyId` groups every token produced by one
 * rotation chain (one login = one family); `replacedByTokenHash`
 * records the chain for audit purposes. See ARCHITECTURE.md §6 for
 * the full rotation + reuse-detection design this schema supports.
 *
 * TTL index on `expiresAt`: MongoDB automatically deletes documents
 * some time after this timestamp passes — expired refresh tokens
 * don't need to be kept around, unlike audit logs.
 */
const refreshTokenSchema = new Schema<IRefreshToken>({
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
  familyId: {
    type: String,
    required: true,
    index: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  revokedAt: {
    type: Date,
  },
  replacedByTokenHash: {
    type: String,
  },
  userAgent: {
    type: String,
  },
  ipAddress: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshTokenModel = model<IRefreshToken>('RefreshToken', refreshTokenSchema);
