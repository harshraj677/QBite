import { z } from 'zod';

import { env } from '@config/env';
import { OTP_LENGTH, PASSWORD_MIN_LENGTH } from './auth.constants';

/**
 * Shared field schemas, composed into the per-endpoint request
 * schemas below. Zod is the single source of truth for both runtime
 * validation and the inferred request-body TypeScript types used by
 * the service layer — no separate hand-written DTO interfaces for
 * request shapes (only for *response* shapes, in auth.types.ts /
 * user.types.ts, which aren't 1:1 with what the client sent).
 */

// USN format is institution-specific and not known at this stage —
// this is a deliberately generic "looks like an ID" pattern
// (uppercase alphanumeric, 6-15 chars), not tied to one university's
// exact scheme. Tighten once the target institution is confirmed.
const usnSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6,15}$/, 'USN must be 6-15 uppercase letters/digits.');

const fullNameSchema = z.string().trim().min(2, 'Full name is too short.').max(100);

const collegeEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Invalid email address.')
  .refine((email) => !env.collegeEmailDomain || email.endsWith(`@${env.collegeEmailDomain}`), {
    message: env.collegeEmailDomain
      ? `Email must be a @${env.collegeEmailDomain} address.`
      : undefined,
  });

const phoneNumberSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number.');

// At least one lowercase, one uppercase, one digit, one special
// character — a conventional strength policy, applied to both
// registration and password reset (never to login — an existing
// password may predate a policy change and must still work).
const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(72, 'Password must be at most 72 characters.') // bcrypt silently truncates beyond 72 bytes — reject instead of silently weakening it
  .regex(/[a-z]/, 'Password must contain a lowercase letter.')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter.')
  .regex(/[0-9]/, 'Password must contain a digit.')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain a special character.');

const otpSchema = z
  .string()
  .trim()
  .regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), `OTP must be ${OTP_LENGTH} digits.`);

export const registerSchema = z.object({
  usn: usnSchema,
  fullName: fullNameSchema,
  collegeEmail: collegeEmailSchema,
  phoneNumber: phoneNumberSchema,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const verifyEmailSchema = z.object({
  collegeEmail: collegeEmailSchema,
  otp: otpSchema,
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

// Login intentionally accepts USN OR college email in one field —
// auth.service.ts detects which by shape (contains '@' -> email).
// Password strength is NOT re-validated here (see passwordSchema's
// comment above).
export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'USN or college email is required.'),
  password: z.string().min(1, 'Password is required.'),
});
export type LoginInput = z.infer<typeof loginSchema>;

// refreshToken is optional in the body because a web client supplies
// it via the httpOnly cookie instead — see ARCHITECTURE.md §4.3.
export const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const logoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});
export type LogoutInput = z.infer<typeof logoutSchema>;

export const forgotPasswordSchema = z.object({
  collegeEmail: collegeEmailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required.'),
  newPassword: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
