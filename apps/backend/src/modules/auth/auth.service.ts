import { randomUUID } from 'node:crypto';

import type { Types } from 'mongoose';

import { env } from '@config/env';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '@errors/http-errors';
import { logger } from '@logging/logger';
import type { IUser, UserRole } from '@modules/users/user.types';
import { toPublicUserDto } from '@modules/users/user.types';
import type { PublicUserDto } from '@modules/users/user.types';
import { UsersService } from '@modules/users/users.service';
import {
  ACCOUNT_LOCK_DURATION_MINUTES,
  ACCOUNT_LOCK_THRESHOLD,
  OTP_EXPIRY_MINUTES,
  OTP_MAX_ATTEMPTS,
  PASSWORD_RESET_TOKEN_EXPIRY_MINUTES,
} from './auth.constants';
import { AuditLogRepository } from './audit-log.repository';
import type { AuditAction, AuthTokensDto } from './auth.types';
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from './auth.validation';
import { EmailService, LoggingEmailService } from './email.service';
import { generateOtp, hashOtp, verifyOtp } from './otp.util';
import { PasswordResetTokenRepository } from './password-reset-token.repository';
import { hashPassword, verifyPassword } from './password.util';
import { RefreshTokenRepository } from './refresh-token.repository';
import {
  generateOpaqueToken,
  hashOpaqueToken,
  parseDurationToMs,
  signAccessToken,
} from './token.util';
import { VerificationOtpRepository } from './verification-otp.repository';

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 11000
  );
}

/**
 * Orchestrates every IAM flow. Depends on `UsersService` (never
 * `UsersRepository` directly — see ARCHITECTURE.md §3.1's module
 * boundary rule) plus its own module's repositories.
 */
export class AuthService {
  constructor(
    private readonly usersService: UsersService = new UsersService(),
    private readonly refreshTokenRepository: RefreshTokenRepository = new RefreshTokenRepository(),
    private readonly otpRepository: VerificationOtpRepository = new VerificationOtpRepository(),
    private readonly passwordResetTokenRepository: PasswordResetTokenRepository = new PasswordResetTokenRepository(),
    private readonly auditLogRepository: AuditLogRepository = new AuditLogRepository(),
    private readonly emailService: EmailService = new LoggingEmailService(),
  ) {}

  async register(input: RegisterInput, meta: RequestMeta): Promise<PublicUserDto> {
    const [existingEmail, existingUsn, existingPhone] = await Promise.all([
      this.usersService.findByCollegeEmail(input.collegeEmail),
      this.usersService.findByUsn(input.usn),
      this.usersService.findByPhoneNumber(input.phoneNumber),
    ]);
    if (existingEmail)
      throw new ConflictError(
        'EMAIL_ALREADY_REGISTERED',
        'This college email is already registered.',
      );
    if (existingUsn)
      throw new ConflictError('USN_ALREADY_REGISTERED', 'This USN is already registered.');
    if (existingPhone)
      throw new ConflictError(
        'PHONE_ALREADY_REGISTERED',
        'This phone number is already registered.',
      );

    const passwordHash = await hashPassword(input.password);

    let user: IUser;
    try {
      user = await this.usersService.createStudent({
        usn: input.usn,
        fullName: input.fullName,
        collegeEmail: input.collegeEmail,
        phoneNumber: input.phoneNumber,
        passwordHash,
      });
    } catch (error) {
      // Two concurrent registrations racing past the pre-checks above
      // and both hitting the DB's unique index — the index is the
      // real guarantee, the findBy* calls above are just a
      // fast-path/better-error-message optimization.
      if (isDuplicateKeyError(error)) {
        throw new ConflictError(
          'ACCOUNT_ALREADY_EXISTS',
          'An account with these details already exists.',
        );
      }
      throw error;
    }

    await this.issueAndSendOtp(user);
    await this.recordAudit({
      actorId: user._id,
      actorRole: user.role,
      action: 'auth.register',
      success: true,
      meta,
    });

    return toPublicUserDto(user);
  }

  async verifyEmail(input: VerifyEmailInput, meta: RequestMeta): Promise<PublicUserDto> {
    const invalidOtp = () =>
      new UnauthorizedError('OTP_INVALID', 'Invalid or expired verification code.');

    const user = await this.usersService.findByCollegeEmail(input.collegeEmail);
    if (!user) {
      await this.recordAudit({
        action: 'auth.email.verification_failed',
        success: false,
        meta,
        metadata: { reason: 'user_not_found' },
      });
      throw invalidOtp();
    }

    if (user.isEmailVerified) {
      return toPublicUserDto(user);
    }

    const otpRecord = await this.otpRepository.findLatestActive(user._id, 'email_verification');
    if (!otpRecord || otpRecord.expiresAt < new Date()) {
      await this.recordAudit({
        actorId: user._id,
        actorRole: user.role,
        action: 'auth.email.verification_failed',
        success: false,
        meta,
        metadata: { reason: 'otp_missing_or_expired' },
      });
      throw invalidOtp();
    }

    if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
      await this.recordAudit({
        actorId: user._id,
        actorRole: user.role,
        action: 'auth.email.verification_failed',
        success: false,
        meta,
        metadata: { reason: 'too_many_attempts' },
      });
      throw invalidOtp();
    }

    const matches = await verifyOtp(input.otp, otpRecord.otpHash);
    if (!matches) {
      await this.otpRepository.incrementAttempts(otpRecord._id);
      await this.recordAudit({
        actorId: user._id,
        actorRole: user.role,
        action: 'auth.email.verification_failed',
        success: false,
        meta,
        metadata: { reason: 'otp_mismatch' },
      });
      throw invalidOtp();
    }

    await this.otpRepository.markConsumed(otpRecord._id);
    await this.usersService.setEmailVerified(user._id);
    user.isEmailVerified = true;

    await this.recordAudit({
      actorId: user._id,
      actorRole: user.role,
      action: 'auth.email.verified',
      success: true,
      meta,
    });

    return toPublicUserDto(user);
  }

  async login(
    input: LoginInput,
    meta: RequestMeta,
  ): Promise<{ user: PublicUserDto } & AuthTokensDto> {
    const isEmail = input.identifier.includes('@');
    const user = isEmail
      ? await this.usersService.findByCollegeEmailWithPassword(input.identifier.toLowerCase())
      : await this.usersService.findByUsnWithPassword(input.identifier.toUpperCase());

    const invalidCredentials = () =>
      new UnauthorizedError('INVALID_CREDENTIALS', 'Incorrect USN/email or password.');

    if (!user) {
      await this.recordAudit({
        action: 'auth.login.failure',
        success: false,
        meta,
        metadata: { reason: 'user_not_found', identifier: input.identifier },
      });
      throw invalidCredentials();
    }

    // Checked before the password comparison: a locked account must
    // not leak whether the supplied password happens to be correct.
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.recordAudit({
        actorId: user._id,
        actorRole: user.role,
        action: 'auth.login.failure',
        success: false,
        meta,
        metadata: { reason: 'account_locked' },
      });
      throw new ForbiddenError(
        'ACCOUNT_LOCKED',
        `Account is temporarily locked due to repeated failed attempts. Try again after ${user.lockedUntil.toISOString()}.`,
      );
    }

    const passwordMatches = await verifyPassword(input.password, user.passwordHash);
    if (!passwordMatches) {
      const updated = await this.usersService.recordFailedLogin(user._id, {
        lockThreshold: ACCOUNT_LOCK_THRESHOLD,
        lockDurationMs: ACCOUNT_LOCK_DURATION_MINUTES * 60_000,
      });
      const justLocked = Boolean(updated && updated.failedLoginAttempts >= ACCOUNT_LOCK_THRESHOLD);
      await this.recordAudit({
        actorId: user._id,
        actorRole: user.role,
        action: justLocked ? 'auth.account.locked' : 'auth.login.failure',
        success: false,
        meta,
        metadata: { reason: 'invalid_password' },
      });
      throw invalidCredentials();
    }

    // Password is correct beyond this point — safe to give specific
    // feedback instead of the generic invalid-credentials error.
    if (!user.isEmailVerified) {
      await this.recordAudit({
        actorId: user._id,
        actorRole: user.role,
        action: 'auth.login.failure',
        success: false,
        meta,
        metadata: { reason: 'email_not_verified' },
      });
      throw new ForbiddenError(
        'EMAIL_NOT_VERIFIED',
        'Please verify your college email before logging in.',
      );
    }

    if (!user.isActive) {
      await this.recordAudit({
        actorId: user._id,
        actorRole: user.role,
        action: 'auth.login.failure',
        success: false,
        meta,
        metadata: { reason: 'account_disabled' },
      });
      throw new ForbiddenError('ACCOUNT_DISABLED', 'This account has been disabled.');
    }

    await this.usersService.resetFailedLoginAttempts(user._id);
    await this.usersService.updateLastLoginAt(user._id);

    const { dto: tokens } = await this.issueTokenPair(user, meta);

    await this.recordAudit({
      actorId: user._id,
      actorRole: user.role,
      action: 'auth.login.success',
      success: true,
      meta,
    });

    return { user: toPublicUserDto(user), ...tokens };
  }

  async refresh(rawRefreshToken: string, meta: RequestMeta): Promise<AuthTokensDto> {
    const tokenHash = hashOpaqueToken(rawRefreshToken);
    const record = await this.refreshTokenRepository.findByTokenHash(tokenHash);

    const invalidToken = () =>
      new UnauthorizedError('REFRESH_TOKEN_INVALID', 'Invalid or expired refresh token.');

    if (!record) throw invalidToken();

    if (record.revokedAt) {
      // A revoked token being presented again means it was already
      // rotated past — this exact scenario is the reuse-detection
      // signal described in ARCHITECTURE.md §6. Assume compromise:
      // kill every token in the family, not just this one.
      await this.refreshTokenRepository.revokeFamily(record.familyId);
      await this.recordAudit({
        actorId: record.userId,
        action: 'auth.token.reuse_detected',
        success: false,
        meta,
        metadata: { familyId: record.familyId },
      });
      throw invalidToken();
    }

    if (record.expiresAt < new Date()) throw invalidToken();

    const user = await this.usersService.findById(record.userId);
    if (!user || !user.isActive) throw invalidToken();

    const { dto: tokens, tokenHash: newTokenHash } = await this.issueTokenPair(
      user,
      meta,
      record.familyId,
    );
    await this.refreshTokenRepository.revoke(record._id, newTokenHash);

    await this.recordAudit({
      actorId: user._id,
      actorRole: user.role,
      action: 'auth.token.refreshed',
      success: true,
      meta,
    });

    return tokens;
  }

  async logout(rawRefreshToken: string | undefined, meta: RequestMeta): Promise<void> {
    if (!rawRefreshToken) return;

    const tokenHash = hashOpaqueToken(rawRefreshToken);
    const record = await this.refreshTokenRepository.findByTokenHash(tokenHash);

    // Always succeeds from the caller's perspective either way —
    // logout must not leak whether the token it was given was valid.
    if (record && !record.revokedAt) {
      await this.refreshTokenRepository.revoke(record._id);
      await this.recordAudit({
        actorId: record.userId,
        action: 'auth.logout',
        success: true,
        meta,
      });
    }
  }

  async forgotPassword(input: ForgotPasswordInput, meta: RequestMeta): Promise<void> {
    const user = await this.usersService.findByCollegeEmail(input.collegeEmail);

    // No branch on the response — identical outcome whether or not
    // the email is registered, to resist account enumeration.
    if (user) {
      await this.passwordResetTokenRepository.invalidateActiveForUser(user._id);

      const rawToken = generateOpaqueToken();
      const tokenHash = hashOpaqueToken(rawToken);
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_EXPIRY_MINUTES * 60_000);
      await this.passwordResetTokenRepository.create({ userId: user._id, tokenHash, expiresAt });

      await this.emailService.send({
        to: user.collegeEmail,
        subject: 'Reset your QBite password',
        body: `Use this code to reset your password: ${rawToken}\nThis code expires in ${PASSWORD_RESET_TOKEN_EXPIRY_MINUTES} minutes. If you didn't request this, you can safely ignore this email.`,
      });

      await this.recordAudit({
        actorId: user._id,
        actorRole: user.role,
        action: 'auth.password.reset_requested',
        success: true,
        meta,
      });
    }
  }

  async resetPassword(input: ResetPasswordInput, meta: RequestMeta): Promise<void> {
    const tokenHash = hashOpaqueToken(input.token);
    const record = await this.passwordResetTokenRepository.findByTokenHash(tokenHash);

    const invalidToken = () =>
      new UnauthorizedError('RESET_TOKEN_INVALID', 'Invalid or expired reset token.');

    if (!record || record.consumedAt || record.expiresAt < new Date()) throw invalidToken();

    const passwordHash = await hashPassword(input.newPassword);
    await this.usersService.updatePasswordHash(record.userId, passwordHash);
    await this.passwordResetTokenRepository.markConsumed(record._id);

    // A password reset is a strong enough event to terminate every
    // existing session, not just this one device — protects against
    // an attacker holding a stolen (but not yet used/detected)
    // refresh token from an earlier compromise.
    await this.refreshTokenRepository.revokeAllForUser(record.userId);

    await this.recordAudit({
      actorId: record.userId,
      action: 'auth.password.reset_completed',
      success: true,
      meta,
    });
  }

  async me(userId: string): Promise<PublicUserDto> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundError('USER_NOT_FOUND', 'User not found.');
    return toPublicUserDto(user);
  }

  private async issueAndSendOtp(user: IUser): Promise<void> {
    const otp = generateOtp();
    const otpHash = await hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000);

    await this.otpRepository.create({
      userId: user._id,
      otpHash,
      purpose: 'email_verification',
      expiresAt,
    });

    await this.emailService.send({
      to: user.collegeEmail,
      subject: 'Verify your QBite account',
      body: `Your verification code is ${otp}\nThis code expires in ${OTP_EXPIRY_MINUTES} minutes.`,
    });
  }

  /**
   * `familyId`: omitted on login (starts a new rotation family), or
   * the current family's ID on refresh (continues the existing chain
   * — see ARCHITECTURE.md §6 for the reuse-detection this enables).
   */
  private async issueTokenPair(
    user: IUser,
    meta: RequestMeta,
    familyId?: string,
  ): Promise<{ dto: AuthTokensDto; tokenHash: string }> {
    const { token: accessToken, expiresIn } = signAccessToken({
      sub: user._id.toString(),
      role: user.role,
    });

    const rawRefreshToken = generateOpaqueToken();
    const tokenHash = hashOpaqueToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + parseDurationToMs(env.jwt.refreshExpiry));

    await this.refreshTokenRepository.create({
      userId: user._id,
      tokenHash,
      familyId: familyId ?? randomUUID(),
      expiresAt,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });

    return { dto: { accessToken, refreshToken: rawRefreshToken, expiresIn }, tokenHash };
  }

  /** Never throws — an audit-logging failure must not break the auth flow it's observing. */
  private async recordAudit(input: {
    actorId?: Types.ObjectId;
    actorRole?: UserRole;
    action: AuditAction;
    success: boolean;
    meta: RequestMeta;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.auditLogRepository.create({
        actorId: input.actorId,
        actorRole: input.actorRole,
        action: input.action,
        success: input.success,
        ipAddress: input.meta.ipAddress,
        userAgent: input.meta.userAgent,
        metadata: input.metadata,
      });
    } catch (error) {
      logger.error({ err: error }, 'Failed to write audit log');
    }
  }
}
