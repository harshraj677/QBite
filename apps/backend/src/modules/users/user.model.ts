import { model, Schema } from 'mongoose';

import type { IUser } from './user.types';
import { USER_ROLES } from './user.types';

/**
 * See docs/DATABASE_DESIGN.md §2.1 for field-by-field rationale.
 *
 * `passwordHash` uses `select: false` — it is never returned by a
 * default query (`User.findById(...)`), only when a repository method
 * explicitly opts in with `.select('+passwordHash')`. This is a
 * second, independent layer of protection on top of `toPublicUserDto`
 * only ever exposing safe fields — a bug in the DTO mapper still
 * can't leak the hash if the query never fetched it.
 */
const userSchema = new Schema<IUser>(
  {
    usn: {
      type: String,
      unique: true,
      sparse: true, // not every role has a USN (only students)
      uppercase: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    collegeEmail: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: 'student',
      required: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockedUntil: {
      type: Date,
    },
    lastLoginAt: {
      type: Date,
    },
    passwordChangedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

userSchema.index({ role: 1 });

export const UserModel = model<IUser>('User', userSchema);
