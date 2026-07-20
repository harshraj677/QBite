'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { apiFetchData } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { getAccessToken, setAccessToken } from '@/lib/api/token-store';
import { ADMIN_PANEL_ROLES, type AuthUser } from '@/types/auth';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * `/auth/login` itself doesn't restrict by role — any valid
 * credentials succeed, since the same endpoint serves the (not yet
 * built) student-facing app too. This admin panel draws its own line:
 * a `student` account authenticates fine but has nothing to do here
 * (every screen would just render empty/403), so it's rejected with a
 * clear message instead of dropped into a broken-looking dashboard.
 */
function assertAdminAccessible(user: AuthUser): void {
  if (!ADMIN_PANEL_ROLES.includes(user.role as (typeof ADMIN_PANEL_ROLES)[number])) {
    throw new ApiError(
      'ADMIN_PANEL_ACCESS_DENIED',
      'This account does not have access to the admin panel.',
      403,
    );
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const router = useRouter();
  // StrictMode double-invokes effects in dev — without this guard, the
  // silent refresh below fires twice on mount, and the second call
  // races the first for the *same* rotating refresh token (one wins,
  // one gets a legitimate-looking 401 and would wrongly flip us back
  // to unauthenticated after the first already succeeded).
  const hasAttemptedSilentAuth = useRef(false);

  useEffect(() => {
    if (hasAttemptedSilentAuth.current) return;
    hasAttemptedSilentAuth.current = true;

    let cancelled = false;
    (async () => {
      try {
        const { accessToken } = await apiFetchData<{ accessToken: string }>('/auth/refresh', {
          method: 'POST',
          body: {},
        });
        setAccessToken(accessToken);
        const me = await apiFetchData<{ user: AuthUser }>('/auth/me');
        assertAdminAccessible(me.user);
        if (!cancelled) {
          setUser(me.user);
          setStatus('authenticated');
        }
      } catch {
        if (!cancelled) {
          setAccessToken(null);
          setUser(null);
          setStatus('unauthenticated');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const data = await apiFetchData<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { identifier, password },
    });
    assertAdminAccessible(data.user);
    setAccessToken(data.accessToken);
    setUser(data.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try {
      if (getAccessToken()) {
        await apiFetchData('/auth/logout', { method: 'POST', body: {} });
      }
    } catch {
      // Logout is best-effort — the client-side session is cleared
      // below regardless of whether the server call succeeded.
    } finally {
      setAccessToken(null);
      setUser(null);
      setStatus('unauthenticated');
      router.push('/login');
    }
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, status, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider.');
  return ctx;
}
