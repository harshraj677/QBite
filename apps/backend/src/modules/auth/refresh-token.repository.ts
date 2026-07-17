import type { Types } from 'mongoose';

import { RefreshTokenModel } from './refresh-token.model';
import type { IRefreshToken } from './auth.types';

export interface CreateRefreshTokenInput {
  userId: Types.ObjectId;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

export class RefreshTokenRepository {
  create(input: CreateRefreshTokenInput): Promise<IRefreshToken> {
    return RefreshTokenModel.create(input);
  }

  findByTokenHash(tokenHash: string): Promise<IRefreshToken | null> {
    return RefreshTokenModel.findOne({ tokenHash }).exec();
  }

  async revoke(id: Types.ObjectId, replacedByTokenHash?: string): Promise<void> {
    await RefreshTokenModel.updateOne(
      { _id: id },
      { $set: { revokedAt: new Date(), ...(replacedByTokenHash && { replacedByTokenHash }) } },
    ).exec();
  }

  /** Reuse-detection response: an entire rotation chain is compromised, not just one token. */
  async revokeFamily(familyId: string): Promise<void> {
    await RefreshTokenModel.updateMany(
      { familyId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    ).exec();
  }

  /** Used by password reset — every session for the user dies, not just one family. */
  async revokeAllForUser(userId: Types.ObjectId): Promise<void> {
    await RefreshTokenModel.updateMany(
      { userId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    ).exec();
  }
}
