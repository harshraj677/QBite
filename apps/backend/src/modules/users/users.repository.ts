import type { Types } from 'mongoose';

import { UserModel } from './user.model';
import type { UserSortableField } from './users.constants';
import type { IUser, UserRole } from './user.types';
import { USER_ROLES } from './user.types';

export interface CreateUserInput {
  usn?: string;
  fullName: string;
  collegeEmail: string;
  phoneNumber: string;
  passwordHash: string;
  role?: UserRole;
}

export interface SearchUsersOptions {
  /** Matched case-insensitively against fullName, collegeEmail, usn, and phoneNumber (an OR across all four — an admin searching "9876" or "arjun" shouldn't need to know which field it lives in). */
  search?: string;
  role?: UserRole;
  isEmailVerified?: boolean;
  isActive?: boolean;
  page: number;
  limit: number;
  sortBy: UserSortableField;
  sortOrder: 'asc' | 'desc';
}

export interface SearchUsersResult {
  users: IUser[];
  total: number;
}

/** Escapes regex metacharacters in free-text search input before it reaches `$regex` — an unescaped `(`/`*`/etc. in a search box would otherwise throw at query-compile time instead of just matching literally, as a user typing punctuation would expect. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

  // ---------------------------------------------------------------
  // Analytics phase — read-only. Added for `modules/analytics` (see
  // ARCHITECTURE.md §3.1's note).
  // ---------------------------------------------------------------

  /** Every role, zero-filled even when a role has no users — Dashboard's Total Students/Total Staff derive from this (see AnalyticsService for the student-vs-staff grouping). */
  async getRoleCounts(): Promise<Record<UserRole, number>> {
    const rows = await UserModel.aggregate<{ _id: UserRole; count: number }>([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]);
    const counts = Object.fromEntries(USER_ROLES.map((role) => [role, 0])) as Record<
      UserRole,
      number
    >;
    for (const row of rows) counts[row._id] = row.count;
    return counts;
  }

  /** Registered within the given window — User Analytics' "New Users". */
  countNewUsers(filter: { from: Date; to: Date }): Promise<number> {
    return UserModel.countDocuments({ createdAt: { $gte: filter.from, $lte: filter.to } }).exec();
  }

  /** Batch fetch for enriching an id list (e.g. top customers) with names/emails in one round trip instead of N — see ARCHITECTURE.md's `modules/analytics` note on avoiding N+1 queries. */
  findByIds(ids: (string | Types.ObjectId)[]): Promise<IUser[]> {
    return UserModel.find({ _id: { $in: ids } }).exec();
  }

  // ---------------------------------------------------------------
  // Users Management phase (Admin Panel) — the first real list/search
  // surface over `users`; everything before this point only ever
  // fetched one user (by id/email/usn/phone) or an aggregate count.
  // ---------------------------------------------------------------

  async search(options: SearchUsersOptions): Promise<SearchUsersResult> {
    const filter: Record<string, unknown> = {};
    if (options.role) filter.role = options.role;
    if (options.isEmailVerified !== undefined) filter.isEmailVerified = options.isEmailVerified;
    if (options.isActive !== undefined) filter.isActive = options.isActive;
    if (options.search) {
      const pattern = new RegExp(escapeRegex(options.search), 'i');
      filter.$or = [
        { fullName: pattern },
        { collegeEmail: pattern },
        { usn: pattern },
        { phoneNumber: pattern },
      ];
    }

    const sort: Record<string, 1 | -1> = { [options.sortBy]: options.sortOrder === 'asc' ? 1 : -1 };
    const skip = (options.page - 1) * options.limit;

    const [users, total] = await Promise.all([
      UserModel.find(filter).sort(sort).skip(skip).limit(options.limit).exec(),
      UserModel.countDocuments(filter).exec(),
    ]);

    return { users, total };
  }

  /** Plain, unconditional `$set` — trusts the caller (`UsersService.updateRole`) to have already run every legality check; same trust relationship `OrdersRepository.updatePaymentStatus` already documents with its own caller. */
  updateRole(id: string | Types.ObjectId, role: UserRole): Promise<IUser | null> {
    return UserModel.findOneAndUpdate(
      { _id: id },
      { $set: { role } },
      { returnDocument: 'after' },
    ).exec();
  }

  /** Same trust relationship as `updateRole` above — `UsersService.setActive` is the only legal caller. */
  setActive(id: string | Types.ObjectId, isActive: boolean): Promise<IUser | null> {
    return UserModel.findOneAndUpdate(
      { _id: id },
      { $set: { isActive } },
      { returnDocument: 'after' },
    ).exec();
  }

  /**
   * Active-account count across the given roles, optionally excluding
   * one id — the exact question `UsersService`'s "don't lock out every
   * admin" and "don't remove the last super_admin" guards need to ask
   * *before* applying a demotion/deactivation ("if I go through with
   * this, will at least one qualifying account remain?").
   */
  countActive(roles: UserRole[], excludeId?: string | Types.ObjectId): Promise<number> {
    const filter: Record<string, unknown> = { role: { $in: roles }, isActive: true };
    if (excludeId !== undefined) filter._id = { $ne: excludeId };
    return UserModel.countDocuments(filter).exec();
  }
}
