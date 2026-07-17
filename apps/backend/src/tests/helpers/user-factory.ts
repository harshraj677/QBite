import { UserModel } from '@modules/users/user.model';
import type { IUser, UserRole } from '@modules/users/user.types';
import { hashPassword } from '@modules/auth/password.util';

/**
 * Creates a user directly against the test database, bypassing the
 * HTTP API — for tests whose subject is *not* registration itself
 * (e.g. login, refresh, /me) and that just need a user to already
 * exist. Defaults to a verified, active student so most tests don't
 * have to think about the fields they don't care about.
 */
export async function createTestUser(
  overrides: Partial<{
    usn: string;
    fullName: string;
    collegeEmail: string;
    phoneNumber: string;
    password: string;
    role: UserRole;
    isEmailVerified: boolean;
    isActive: boolean;
  }> = {},
): Promise<{ user: IUser; plainPassword: string }> {
  const plainPassword = overrides.password ?? 'Str0ng!Passw0rd';
  const passwordHash = await hashPassword(plainPassword);

  const unique = Math.random().toString(36).slice(2, 8).toUpperCase();

  const user = await UserModel.create({
    usn: overrides.usn ?? `1XX21CS${unique}`,
    fullName: overrides.fullName ?? 'Test Student',
    collegeEmail: overrides.collegeEmail ?? `test.${unique.toLowerCase()}@college.edu`,
    phoneNumber: overrides.phoneNumber ?? `9${Math.floor(100000000 + Math.random() * 899999999)}`,
    passwordHash,
    role: overrides.role ?? 'student',
    isEmailVerified: overrides.isEmailVerified ?? true,
    isActive: overrides.isActive ?? true,
  });

  return { user, plainPassword };
}
