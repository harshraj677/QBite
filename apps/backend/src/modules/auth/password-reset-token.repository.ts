import type { Types } from 'mongoose';

import { PasswordResetTokenModel } from './password-reset-token.model';
import type { IPasswordResetToken } from './auth.types';

export interface CreatePasswordResetTokenInput {
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
}

export class PasswordResetTokenRepository {
  create(input: CreatePasswordResetTokenInput): Promise<IPasswordResetToken> {
    return PasswordResetTokenModel.create(input);
  }

  findByTokenHash(tokenHash: string): Promise<IPasswordResetToken | null> {
    return PasswordResetTokenModel.findOne({ tokenHash }).exec();
  }

  async markConsumed(id: Types.ObjectId): Promise<void> {
    await PasswordResetTokenModel.updateOne(
      { _id: id },
      { $set: { consumedAt: new Date() } },
    ).exec();
  }

  /** Only one active reset request should exist per user at a time. */
  async invalidateActiveForUser(userId: Types.ObjectId): Promise<void> {
    await PasswordResetTokenModel.updateMany(
      { userId, consumedAt: { $exists: false } },
      { $set: { consumedAt: new Date() } },
    ).exec();
  }
}
