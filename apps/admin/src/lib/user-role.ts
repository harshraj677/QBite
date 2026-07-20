import type { UserRole } from '@/types/auth';

/** Single source of truth for how a role renders anywhere in the app — same "one map, imported everywhere" convention as `order-status.ts`. */
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  student: 'Student',
  kitchen_staff: 'Kitchen Staff',
  admin: 'Admin',
  super_admin: 'Super Admin',
};

export const USER_ROLE_BADGE_VARIANT: Record<
  UserRole,
  'secondary' | 'warning' | 'success' | 'destructive'
> = {
  student: 'secondary',
  kitchen_staff: 'warning',
  admin: 'success',
  super_admin: 'destructive',
};

export const STAFF_ROLES: UserRole[] = ['kitchen_staff', 'admin', 'super_admin'];
