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

/**
 * Mirrors the backend's `PublicUserDto` exactly — every field it
 * returns, on every endpoint that returns a user shape (`/auth/me`,
 * `/auth/login`, `/auth/register`, `/users/:id`, `/users`). `isActive`/
 * `lastLoginAt` were added for the Users Management phase (the backend
 * added them to `PublicUserDto` itself — see ARCHITECTURE.md's Users
 * Management note) — purely additive, no existing field changed. This
 * is also the canonical "user" type reused as-is by
 * `features/orders/types.ts`'s `StudentDto` and `features/users/types.ts`'s
 * `UserDto`, rather than each declaring its own parallel shape.
 */
export interface AuthUser {
  id: string;
  usn?: string;
  fullName: string;
  collegeEmail: string;
  phoneNumber: string;
  role: UserRole;
  isEmailVerified: boolean;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}
