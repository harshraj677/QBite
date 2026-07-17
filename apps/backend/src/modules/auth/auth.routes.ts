import { Router } from 'express';

import { validateRequest } from '@validation/validate-request.middleware';
import { authenticate } from './auth.middleware';
import { AuthController } from './auth.controller';
import {
  forgotPasswordRateLimiter,
  loginRateLimiter,
  logoutRateLimiter,
  refreshRateLimiter,
  registerRateLimiter,
  resetPasswordRateLimiter,
  verifyEmailRateLimiter,
} from './auth.rate-limits';
import {
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from './auth.validation';

export const authRouter = Router();
const controller = new AuthController();

/**
 * @openapi
 * components:
 *   schemas:
 *     PublicUser:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         usn: { type: string }
 *         fullName: { type: string }
 *         collegeEmail: { type: string }
 *         phoneNumber: { type: string }
 *         role: { type: string, enum: [student, kitchen_staff, admin, super_admin] }
 *         isEmailVerified: { type: boolean }
 *         createdAt: { type: string, format: date-time }
 *     ErrorEnvelope:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: false }
 *         error:
 *           type: object
 *           properties:
 *             code: { type: string }
 *             message: { type: string }
 *             details: {}
 */

/**
 * @openapi
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new student account
 *     description: Creates a student account (role is always "student" — never client-supplied) and sends a 6-digit email-verification OTP. The account cannot log in until verified.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [usn, fullName, collegeEmail, phoneNumber, password]
 *             properties:
 *               usn: { type: string, example: "1XX21CS001" }
 *               fullName: { type: string, example: "Ada Lovelace" }
 *               collegeEmail: { type: string, format: email }
 *               phoneNumber: { type: string, example: "+919876543210" }
 *               password: { type: string, format: password, minLength: 8 }
 *     responses:
 *       201:
 *         description: Account created; verification code sent.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object, properties: { user: { $ref: '#/components/schemas/PublicUser' } } }
 *       409:
 *         description: USN, email, or phone number already registered.
 *         content: { application/json: { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } }
 *       429:
 *         description: Rate limit exceeded (5/hour per IP).
 */
authRouter.post(
  '/register',
  registerRateLimiter,
  validateRequest({ body: registerSchema }),
  controller.register,
);

/**
 * @openapi
 * /api/v1/auth/verify-email:
 *   post:
 *     summary: Verify a college email with the OTP sent at registration
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [collegeEmail, otp]
 *             properties:
 *               collegeEmail: { type: string, format: email }
 *               otp: { type: string, example: "123456" }
 *     responses:
 *       200:
 *         description: Email verified.
 *       401:
 *         description: Invalid or expired code (also returned for an unknown email, to resist account enumeration).
 *       429:
 *         description: Rate limit exceeded (10/15min per IP).
 */
authRouter.post(
  '/verify-email',
  verifyEmailRateLimiter,
  validateRequest({ body: verifyEmailSchema }),
  controller.verifyEmail,
);

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     summary: Log in with USN or college email
 *     description: Sets the refresh token as an httpOnly cookie (web) and also returns it in the response body (mobile — store via flutter_secure_storage).
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [identifier, password]
 *             properties:
 *               identifier: { type: string, description: "USN or college email" }
 *               password: { type: string, format: password }
 *     responses:
 *       200:
 *         description: Login successful.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     user: { $ref: '#/components/schemas/PublicUser' }
 *                     accessToken: { type: string }
 *                     refreshToken: { type: string }
 *                     expiresIn: { type: number, description: "Access token lifetime, seconds" }
 *       401:
 *         description: Incorrect USN/email or password.
 *       403:
 *         description: Account locked, disabled, or email not verified.
 *       429:
 *         description: Rate limit exceeded (10/15min per IP).
 */
authRouter.post(
  '/login',
  loginRateLimiter,
  validateRequest({ body: loginSchema }),
  controller.login,
);

/**
 * @openapi
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Rotate a refresh token for a new access/refresh token pair
 *     description: Refresh token is read from the httpOnly cookie if present, otherwise from the request body (mobile). Reuse of an already-rotated token revokes every token in its family and requires a full re-login.
 *     tags: [Auth]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string, description: "Omit if sending via cookie" }
 *     responses:
 *       200:
 *         description: New token pair issued.
 *       400:
 *         description: No refresh token supplied (neither cookie nor body).
 *       401:
 *         description: Invalid, expired, or reused refresh token.
 *       429:
 *         description: Rate limit exceeded (30/15min per IP).
 */
authRouter.post(
  '/refresh',
  refreshRateLimiter,
  validateRequest({ body: refreshSchema }),
  controller.refresh,
);

/**
 * @openapi
 * /api/v1/auth/logout:
 *   post:
 *     summary: Revoke the current session's refresh token
 *     description: Idempotent — always returns 200 regardless of whether the supplied token was valid, to avoid leaking token validity. Revokes only this session, not every device.
 *     tags: [Auth]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string, description: "Omit if sending via cookie" }
 *     responses:
 *       200:
 *         description: Logged out.
 *       429:
 *         description: Rate limit exceeded (30/15min per IP).
 */
authRouter.post(
  '/logout',
  logoutRateLimiter,
  validateRequest({ body: logoutSchema }),
  controller.logout,
);

/**
 * @openapi
 * /api/v1/auth/forgot-password:
 *   post:
 *     summary: Request a password-reset code
 *     description: Always returns the same generic response whether or not the email is registered, to resist account enumeration.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [collegeEmail]
 *             properties:
 *               collegeEmail: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Generic acknowledgement (see description).
 *       429:
 *         description: Rate limit exceeded (3/hour per IP).
 */
authRouter.post(
  '/forgot-password',
  forgotPasswordRateLimiter,
  validateRequest({ body: forgotPasswordSchema }),
  controller.forgotPassword,
);

/**
 * @openapi
 * /api/v1/auth/reset-password:
 *   post:
 *     summary: Reset a password using a forgot-password token
 *     description: Revokes every refresh token (all sessions/devices) for the user on success.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token: { type: string }
 *               newPassword: { type: string, format: password, minLength: 8 }
 *     responses:
 *       200:
 *         description: Password reset; all sessions revoked.
 *       401:
 *         description: Invalid or expired reset token.
 *       429:
 *         description: Rate limit exceeded (10/15min per IP).
 */
authRouter.post(
  '/reset-password',
  resetPasswordRateLimiter,
  validateRequest({ body: resetPasswordSchema }),
  controller.resetPassword,
);

/**
 * @openapi
 * /api/v1/auth/me:
 *   get:
 *     summary: Get the current authenticated user's profile
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Current user.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object, properties: { user: { $ref: '#/components/schemas/PublicUser' } } }
 *       401:
 *         description: Missing, invalid, expired, or stale access token.
 */
authRouter.get('/me', authenticate(), controller.me);
