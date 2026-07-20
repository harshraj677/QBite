import type { Document, Types } from 'mongoose';

/**
 * Roles, per this phase's IAM design. `student` is the only role the
 * public registration endpoint can create — `kitchen_staff`/`admin`/
 * `super_admin` accounts are provisioned through a privileged flow
 * that doesn't exist yet (a future admin module), not `/auth/register`.
 */
export const USER_ROLES = ['student', 'kitchen_staff', 'admin', 'super_admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Mongoose document shape — includes sensitive fields (passwordHash). */
export interface IUser extends Document {
  _id: Types.ObjectId;
  usn?: string;
  fullName: string;
  collegeEmail: string;
  phoneNumber: string;
  passwordHash: string;
  role: UserRole;
  isEmailVerified: boolean;
  isActive: boolean;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  lastLoginAt?: Date;
  passwordChangedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * The only shape a user document is ever allowed to cross the API
 * boundary as. `passwordHash`, `failedLoginAttempts`, `lockedUntil`
 * are deliberately excluded — never exposed to a client regardless of
 * which endpoint is asking.
 *
 * `isActive`/`lastLoginAt` were added for the Admin Panel's Users
 * Management phase (real, already-existing `IUser` fields — `isActive`
 * already gates login in `auth.middleware.ts`; `lastLoginAt` is
 * already stamped by `UsersRepository.updateLastLoginAt`, just never
 * previously exposed). Purely additive: every existing consumer of
 * this DTO (`/auth/me`, `/auth/login`, `/auth/register`, `/users/:id`)
 * now also returns these two fields, with no field removed or renamed.
 */
export interface PublicUserDto {
  id: string;
  usn?: string;
  fullName: string;
  collegeEmail: string;
  phoneNumber: string;
  role: UserRole;
  isEmailVerified: boolean;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
}

export function toPublicUserDto(user: IUser): PublicUserDto {
  return {
    id: user._id.toString(),
    usn: user.usn,
    fullName: user.fullName,
    collegeEmail: user.collegeEmail,
    phoneNumber: user.phoneNumber,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}
