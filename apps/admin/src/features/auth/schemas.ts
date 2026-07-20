import { z } from 'zod';

/**
 * Mirrors apps/backend/src/modules/auth/auth.validation.ts's rules
 * exactly — client-side validation exists purely to give faster
 * feedback than a round trip; the backend re-validates everything
 * regardless (never trust the client), so drifting from its rules
 * would just mean a confusing "looked valid, server rejected it"
 * moment for no benefit.
 */

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your USN or college email.'),
  password: z.string().min(1, 'Enter your password.'),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  collegeEmail: z.string().trim().toLowerCase().email('Enter a valid email address.'),
});
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

// Same strength policy as registration/reset on the backend — at
// least one lowercase, uppercase, digit, and special character.
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(72, 'Password must be at most 72 characters.')
  .regex(/[a-z]/, 'Add a lowercase letter.')
  .regex(/[A-Z]/, 'Add an uppercase letter.')
  .regex(/[0-9]/, 'Add a digit.')
  .regex(/[^a-zA-Z0-9]/, 'Add a special character.');

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(1, 'Enter the code from your email.'),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your new password.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
