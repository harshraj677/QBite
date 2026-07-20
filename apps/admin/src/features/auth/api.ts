import { apiFetchData } from '@/lib/api/client';

/**
 * Login/logout/refresh/me are intentionally *not* here — they live in
 * providers/auth-provider.tsx because they mutate global auth state
 * (the current user, the in-memory access token), not just server
 * data. These two don't touch that state at all, so they're plain
 * feature-level API functions instead.
 */

export function requestPasswordReset(collegeEmail: string): Promise<{ message: string }> {
  return apiFetchData<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: { collegeEmail },
  });
}

export function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  return apiFetchData<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: { token, newPassword },
  });
}
