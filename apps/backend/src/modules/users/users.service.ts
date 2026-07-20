import { Types } from 'mongoose';

import { AuditLogService } from '@modules/audit/audit-log.service';
import { ConflictError, ForbiddenError, NotFoundError } from '@errors/http-errors';
import type { CreateUserInput, SearchUsersOptions, SearchUsersResult } from './users.repository';
import { UsersRepository } from './users.repository';
import type { IUser, UserRole } from './user.types';

export interface AuditActor {
  id: string;
  role: UserRole;
}

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

/** Roles `authenticate()` effectively treats as "can operate the Admin Panel" — the set the "at least one must remain active" guard protects (see `setActive` below). */
const ADMIN_CAPABLE_ROLES: UserRole[] = ['admin', 'super_admin'];

/**
 * `users` module's public interface. Per ARCHITECTURE.md §3.1's
 * module boundary rule, every other module — starting with
 * `AuthService` — depends on this, never on `UsersRepository`
 * directly. Deliberately returns raw `IUser` documents (including
 * `passwordHash` where the caller asked for it) rather than
 * `PublicUserDto` — DTO shaping is the *caller's* responsibility at
 * the point it actually sends a response, not this service's, since
 * different callers need different fields (auth needs the password
 * hash to compare; a future profile endpoint wouldn't).
 */
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository = new UsersRepository(),
    private readonly auditLogService: AuditLogService = new AuditLogService(),
  ) {}

  createStudent(input: Omit<CreateUserInput, 'role'>): Promise<IUser> {
    return this.usersRepository.create({ ...input, role: 'student' });
  }

  findById(id: string | Types.ObjectId): Promise<IUser | null> {
    return this.usersRepository.findById(id);
  }

  findByIdWithPassword(id: string | Types.ObjectId): Promise<IUser | null> {
    return this.usersRepository.findByIdWithPassword(id);
  }

  findByCollegeEmail(collegeEmail: string): Promise<IUser | null> {
    return this.usersRepository.findByCollegeEmail(collegeEmail);
  }

  findByCollegeEmailWithPassword(collegeEmail: string): Promise<IUser | null> {
    return this.usersRepository.findByCollegeEmailWithPassword(collegeEmail);
  }

  findByUsnWithPassword(usn: string): Promise<IUser | null> {
    return this.usersRepository.findByUsnWithPassword(usn);
  }

  findByUsn(usn: string): Promise<IUser | null> {
    return this.usersRepository.findByUsn(usn);
  }

  findByPhoneNumber(phoneNumber: string): Promise<IUser | null> {
    return this.usersRepository.findByPhoneNumber(phoneNumber);
  }

  setEmailVerified(id: string | Types.ObjectId): Promise<void> {
    return this.usersRepository.setEmailVerified(id);
  }

  updatePasswordHash(id: string | Types.ObjectId, passwordHash: string): Promise<void> {
    return this.usersRepository.updatePasswordHash(id, passwordHash);
  }

  recordFailedLogin(
    id: string | Types.ObjectId,
    options: { lockThreshold: number; lockDurationMs: number },
  ): Promise<IUser | null> {
    return this.usersRepository.recordFailedLogin(id, options);
  }

  resetFailedLoginAttempts(id: string | Types.ObjectId): Promise<void> {
    return this.usersRepository.resetFailedLoginAttempts(id);
  }

  updateLastLoginAt(id: string | Types.ObjectId): Promise<void> {
    return this.usersRepository.updateLastLoginAt(id);
  }

  // ---------------------------------------------------------------
  // Analytics phase — thin, read-only delegation. `modules/analytics`
  // calls these (never UsersRepository directly).
  // ---------------------------------------------------------------

  getRoleCounts(): Promise<Record<UserRole, number>> {
    return this.usersRepository.getRoleCounts();
  }

  countNewUsers(filter: { from: Date; to: Date }): Promise<number> {
    return this.usersRepository.countNewUsers(filter);
  }

  findByIds(ids: (string | Types.ObjectId)[]): Promise<IUser[]> {
    return this.usersRepository.findByIds(ids);
  }

  // ---------------------------------------------------------------
  // Users Management phase (Admin Panel) — the list/search surface,
  // plus the two mutations `user.types.ts`'s doc comment referred to
  // as "a privileged flow that doesn't exist yet." Both mutations are
  // legality-guarded here, not just RBAC-gated at the route: role and
  // active-status are self-service-lockout-capable fields (an admin
  // could otherwise strip their own access, or everyone's), which is a
  // business rule, not a request-shape rule — it belongs here, the
  // same split `MenuItemsService` already draws between Zod's format
  // validation and this layer's cross-field/business validation.
  // ---------------------------------------------------------------

  searchUsers(options: SearchUsersOptions): Promise<SearchUsersResult> {
    return this.usersRepository.search(options);
  }

  /**
   * Legality, in order:
   *  1. Target must exist.
   *  2. No self-service role change — an admin editing their own
   *     account out of/into a role could otherwise lock themselves out
   *     (or silently self-promote), neither of which should be a side
   *     effect of the same "change someone's role" endpoint.
   *  3. Only a `super_admin` may assign or remove the `super_admin`
   *     role — an `admin` can manage `student`/`kitchen_staff`/`admin`
   *     freely, but touching `super_admin` either direction requires
   *     already holding it.
   *  4. Demoting the last remaining active `super_admin` away from
   *     that role is rejected — there must always be at least one
   *     account able to grant it back.
   */
  async updateRole(
    targetId: string,
    newRole: UserRole,
    actor: AuditActor,
    meta: RequestMeta,
  ): Promise<IUser> {
    const target = await this.usersRepository.findById(targetId);
    if (!target) {
      throw new NotFoundError('USER_NOT_FOUND', 'User not found.');
    }
    if (actor.id === targetId) {
      throw new ConflictError('USER_CANNOT_MODIFY_SELF', 'You cannot change your own role.');
    }
    if (
      actor.role !== 'super_admin' &&
      (target.role === 'super_admin' || newRole === 'super_admin')
    ) {
      throw new ForbiddenError(
        'USER_ROLE_REQUIRES_SUPER_ADMIN',
        'Only a super admin can assign or remove the super_admin role.',
      );
    }
    if (target.role === 'super_admin' && newRole !== 'super_admin') {
      const remaining = await this.usersRepository.countActive(['super_admin'], targetId);
      if (remaining === 0) {
        throw new ConflictError(
          'USER_LAST_SUPER_ADMIN',
          'At least one active super admin account must remain.',
        );
      }
    }

    const previousRole = target.role;
    const updated = await this.usersRepository.updateRole(targetId, newRole);
    if (!updated) {
      throw new NotFoundError('USER_NOT_FOUND', 'User not found.');
    }

    await this.auditLogService.record({
      actorId: new Types.ObjectId(actor.id),
      actorRole: actor.role,
      action: 'user.role_updated',
      success: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { userId: targetId, fromRole: previousRole, toRole: newRole },
    });

    return updated;
  }

  /**
   * Legality, in order:
   *  1. Target must exist.
   *  2. No self-deactivation — `authenticate()` rejects any request
   *     from a disabled account (see auth.middleware.ts), so an admin
   *     deactivating themselves would be an unrecoverable-without-
   *     direct-DB-access lockout, not a reversible mistake.
   *  3. Deactivating the last remaining active admin-capable account
   *     (`admin`/`super_admin`) is rejected for the same reason at
   *     organization scale — someone must always be able to log in and
   *     reactivate everyone else.
   */
  async setActive(
    targetId: string,
    isActive: boolean,
    actor: AuditActor,
    meta: RequestMeta,
  ): Promise<IUser> {
    const target = await this.usersRepository.findById(targetId);
    if (!target) {
      throw new NotFoundError('USER_NOT_FOUND', 'User not found.');
    }
    if (actor.id === targetId) {
      throw new ConflictError(
        'USER_CANNOT_MODIFY_SELF',
        `You cannot ${isActive ? 'reactivate' : 'deactivate'} your own account.`,
      );
    }
    if (!isActive && ADMIN_CAPABLE_ROLES.includes(target.role)) {
      const remaining = await this.usersRepository.countActive(ADMIN_CAPABLE_ROLES, targetId);
      if (remaining === 0) {
        throw new ConflictError(
          'USER_LAST_ACTIVE_ADMIN',
          'At least one active admin account must remain.',
        );
      }
    }

    const updated = await this.usersRepository.setActive(targetId, isActive);
    if (!updated) {
      throw new NotFoundError('USER_NOT_FOUND', 'User not found.');
    }

    await this.auditLogService.record({
      actorId: new Types.ObjectId(actor.id),
      actorRole: actor.role,
      action: isActive ? 'user.activated' : 'user.deactivated',
      success: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { userId: targetId },
    });

    return updated;
  }
}
