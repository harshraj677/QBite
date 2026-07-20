/** Mirrors apps/backend/src/modules/users/user.types.ts's USER_ROLES/PublicUserDto exactly. */
export const USER_ROLES = ['student', 'kitchen_staff', 'admin', 'super_admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * Roles this admin panel actually serves. The backend's `/auth/login`
 * itself doesn't restrict by role (any valid credentials succeed) —
 * this app enforces the boundary on its own side, see
 * providers/auth-provider.tsx's `assertAdminAccessible`. A `student`
 * account can authenticate against the API but has nothing to do
 * here; every admin-panel screen would just render empty/403 states
 * for one, so it's rejected at login instead of after.
 */
export const ADMIN_PANEL_ROLES = ['kitchen_staff', 'admin', 'super_admin'] as const satisfies readonly UserRole[];
export type AdminPanelRole = (typeof ADMIN_PANEL_ROLES)[number];

export interface AuthUser {
  id: string;
  usn?: string;
  fullName: string;
  collegeEmail: string;
  phoneNumber: string;
  role: UserRole;
  isEmailVerified: boolean;
  createdAt: string;
}
