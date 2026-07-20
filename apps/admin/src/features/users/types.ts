import type { UserRole } from '@/types/auth';

export type { AuthUser as UserDto, UserRole } from '@/types/auth';
export { USER_ROLES } from '@/types/auth';

export type UserSortableField = 'fullName' | 'collegeEmail' | 'createdAt' | 'lastLoginAt';

export interface UsersFilters {
  search?: string;
  role?: UserRole;
  isEmailVerified?: boolean;
  isActive?: boolean;
}

export interface UsersQueryParams extends UsersFilters {
  page: number;
  limit: number;
  sortBy: UserSortableField;
  sortOrder: 'asc' | 'desc';
}
