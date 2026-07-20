import type { Types } from 'mongoose';

import type { CreateUserInput } from './users.repository';
import { UsersRepository } from './users.repository';
import type { IUser, UserRole } from './user.types';

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
  constructor(private readonly usersRepository: UsersRepository = new UsersRepository()) {}

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
}
