import { Router } from 'express';

/**
 * API v1 mount point (docs/API_SPECIFICATION.md §7 — URI-based
 * versioning: everything lives under `/api/v1`).
 *
 * Empty by design: a future module registers itself with
 * `v1Router.use('/auth', authRouter)` etc. A breaking change to an
 * existing route gets its own `src/api/v2/index.ts` mounted alongside
 * this one — v1 keeps working unmodified, per the deprecation policy
 * in API_SPECIFICATION.md §7.
 */
export const v1Router = Router();
