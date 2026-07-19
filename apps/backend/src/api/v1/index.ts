import { Router } from 'express';

import { authRouter } from '@modules/auth/auth.routes';
import { canteensRouter } from '@modules/canteens/canteens.routes';
import { kitchenRouter } from '@modules/kitchen/kitchen.routes';
import { menuCategoriesRouter } from '@modules/menu/menu-categories.routes';
import { menuItemsRouter } from '@modules/menu/menu-items.routes';
import { ordersRouter } from '@modules/orders/orders.routes';

/**
 * API v1 mount point (docs/API_SPECIFICATION.md §7 — URI-based
 * versioning: everything lives under `/api/v1`).
 *
 * `auth` was the first module mounted here; `canteens` is the first
 * business/domain module. A breaking change to an existing route gets
 * its own `src/api/v2/index.ts` mounted alongside this one — v1 keeps
 * working unmodified, per the deprecation policy in
 * API_SPECIFICATION.md §7.
 *
 * `menuCategoriesRouter`/`menuItemsRouter` are mounted at `/` (not a
 * fixed prefix) because their own routes mix two shapes —
 * `/canteens/:canteenId/categories` (nested under canteens) and
 * `/categories/:id` (top-level). Mounted after `canteensRouter`:
 * `canteensRouter` only owns single-segment paths under `/canteens`
 * (`/canteens/:id`, `/canteens/:id/status`), so a request like
 * `/canteens/<id>/categories` doesn't match anything inside it and
 * falls through to these routers, per Express's normal sub-router
 * fallthrough — no route in `canteensRouter` was touched to make this
 * work.
 */
export const v1Router = Router();

v1Router.use('/auth', authRouter);
v1Router.use('/canteens', canteensRouter);
v1Router.use('/', menuCategoriesRouter);
v1Router.use('/', menuItemsRouter);
v1Router.use('/', ordersRouter);
v1Router.use('/kitchen', kitchenRouter);
