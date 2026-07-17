import { createRateLimiter } from '@middlewares/rate-limiter.middleware';

/**
 * Per-endpoint limits, layered on top of the global default limiter
 * (already applied to every request in app.ts) — exactly the pattern
 * ARCHITECTURE.md §3.2 said a future module would use:
 * `createRateLimiter(...)` per route, no new architecture needed.
 *
 * These are IP-based and independent of the account-level lockout in
 * auth.service.ts (see ARCHITECTURE.md §6) — two different attacks,
 * two different defenses.
 */
export const registerRateLimiter = createRateLimiter({ windowMs: 60 * 60_000, max: 5 });
export const verifyEmailRateLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 10 });
export const loginRateLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 10 });
export const refreshRateLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 30 });
export const logoutRateLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 30 });
export const forgotPasswordRateLimiter = createRateLimiter({ windowMs: 60 * 60_000, max: 3 });
export const resetPasswordRateLimiter = createRateLimiter({ windowMs: 15 * 60_000, max: 10 });
