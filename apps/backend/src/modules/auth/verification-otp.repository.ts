import type { Types } from 'mongoose';

import { VerificationOtpModel } from './verification-otp.model';
import type { IVerificationOtp, OtpPurpose } from './auth.types';

export interface CreateOtpInput {
  userId: Types.ObjectId;
  otpHash: string;
  purpose: OtpPurpose;
  expiresAt: Date;
}

export class VerificationOtpRepository {
  create(input: CreateOtpInput): Promise<IVerificationOtp> {
    return VerificationOtpModel.create(input);
  }

  /** The most recent, not-yet-consumed OTP for this user/purpose — older ones are superseded, not deleted (kept for audit trail via TTL expiry instead). */
  findLatestActive(userId: Types.ObjectId, purpose: OtpPurpose): Promise<IVerificationOtp | null> {
    return VerificationOtpModel.findOne({ userId, purpose, consumedAt: { $exists: false } })
      .sort({ createdAt: -1 })
      .exec();
  }

  async incrementAttempts(id: Types.ObjectId): Promise<void> {
    await VerificationOtpModel.updateOne({ _id: id }, { $inc: { attempts: 1 } }).exec();
  }

  async markConsumed(id: Types.ObjectId): Promise<void> {
    await VerificationOtpModel.updateOne({ _id: id }, { $set: { consumedAt: new Date() } }).exec();
  }
}
