import type { Types } from 'mongoose';

import { UserModel } from './user.model';
import type { IUser, UserRole } from './user.types';

export interface CreateUserInput {
  usn?: string;
  fullName: string;
  collegeEmail: string;
  phoneNumber: string;
  passwordHash: string;
  role?: UserRole;
}

/**
 * All Mongoose queries for the `users` collection live here — per
 * ARCHITECTURE.md §3.1's layering rule, nothing outside this file
 * touches `UserModel` directly, including `AuthService` (which goes
 * through `UsersService`, not this repository, per the module
 * boundary rule).
 */
export class UsersRepository {
  create(input: CreateUserInput): Promise<IUser> {
    return UserModel.create(input);
  }

  findById(id: string | Types.ObjectId): Promise<IUser | null> {
    return UserModel.findById(id).exec();
  }

  /** Includes `passwordHash` — only for the login/reset-password flows that need to compare or overwrite it. */
  findByIdWithPassword(id: string | Types.ObjectId): Promise<IUser | null> {
    return UserModel.findById(id).select('+passwordHash').exec();
  }

  findByCollegeEmail(collegeEmail: string): Promise<IUser | null> {
    return UserModel.findOne({ collegeEmail: collegeEmail.toLowerCase() }).exec();
  }

  /** Includes `passwordHash` — only the login flow needs this. */
  findByCollegeEmailWithPassword(collegeEmail: string): Promise<IUser | null> {
    return UserModel.findOne({ collegeEmail: collegeEmail.toLowerCase() })
      .select('+passwordHash')
      .exec();
  }

  findByUsn(usn: string): Promise<IUser | null> {
    return UserModel.findOne({ usn: usn.toUpperCase() }).exec();
  }

  /** Includes `passwordHash` — only the login flow needs this. */
  findByUsnWithPassword(usn: string): Promise<IUser | null> {
    return UserModel.findOne({ usn: usn.toUpperCase() }).select('+passwordHash').exec();
  }

  findByPhoneNumber(phoneNumber: string): Promise<IUser | null> {
    return UserModel.findOne({ phoneNumber }).exec();
  }

  async setEmailVerified(id: string | Types.ObjectId): Promise<void> {
    await UserModel.updateOne({ _id: id }, { $set: { isEmailVerified: true } }).exec();
  }

  /**
   * Also resets lockout state — a password reset is a strong enough
   * proof of identity that any pre-existing lockout no longer applies.
   */
  async updatePasswordHash(id: string | Types.ObjectId, passwordHash: string): Promise<void> {
    await UserModel.updateOne(
      { _id: id },
      {
        $set: { passwordHash, passwordChangedAt: new Date(), failedLoginAttempts: 0 },
        $unset: { lockedUntil: '' },
      },
    ).exec();
  }

  async recordFailedLogin(
    id: string | Types.ObjectId,
    options: { lockThreshold: number; lockDurationMs: number },
  ): Promise<IUser | null> {
    const user = await UserModel.findByIdAndUpdate(
      id,
      { $inc: { failedLoginAttempts: 1 } },
      { returnDocument: 'after' },
    ).exec();

    if (user && user.failedLoginAttempts >= options.lockThreshold) {
      user.lockedUntil = new Date(Date.now() + options.lockDurationMs);
      await user.save();
    }

    return user;
  }

  async resetFailedLoginAttempts(id: string | Types.ObjectId): Promise<void> {
    await UserModel.updateOne(
      { _id: id },
      { $set: { failedLoginAttempts: 0 }, $unset: { lockedUntil: '' } },
    ).exec();
  }

  async updateLastLoginAt(id: string | Types.ObjectId): Promise<void> {
    await UserModel.updateOne({ _id: id }, { $set: { lastLoginAt: new Date() } }).exec();
  }
}
