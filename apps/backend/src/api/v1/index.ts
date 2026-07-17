import { Router } from 'express';

import { authRouter } from '@modules/auth/auth.routes';
import { canteensRouter } from '@modules/canteens/canteens.routes';

/**
 * API v1 mount point (docs/API_SPECIFICATION.md §7 — URI-based
 * versioning: everything lives under `/api/v1`).
 *
 * `auth` was the first module mounted here; `canteens` is the first
 * business/domain module. A breaking change to an existing route gets
 * its own `src/api/v2/index.ts` mounted alongside this one — v1 keeps
 * working unmodified, per the deprecation policy in
 * API_SPECIFICATION.md §7.
 */
export const v1Router = Router();

v1Router.use('/auth', authRouter);
v1Router.use('/canteens', canteensRouter);
