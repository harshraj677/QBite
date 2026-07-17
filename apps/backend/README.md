# QBite Backend

Node.js/Express/TypeScript modular monolith API. See the repo root [`README.md`](../../README.md) and [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md#3-backend-architecture-nodejs--express) for full context — this file only covers what's specific to running this app.

## Structure

- `src/config/` — environment (`env.ts`, Zod-validated), MongoDB connection (`database.ts` — now invoked at bootstrap; see `server.ts`), Swagger/OpenAPI setup.
- `src/errors/` — `AppError` + one subclass per HTTP-status/error-code pairing (`docs/API_SPECIFICATION.md` §5.1).
- `src/validation/` — generic Zod-based `validateRequest(schemas)` middleware factory.
- `src/context/` — `AsyncLocalStorage`-based request context (request ID).
- `src/logging/` — the structured `pino` logger.
- `src/response/` — `sendSuccess`/`sendPaginated` response-envelope builders.
- `src/middlewares/` — request ID, request logging, security (helmet/hpp/sanitize), rate limiting, not-found, centralized error handling.
- `src/utils/` — `catchAsync` (async route wrapper), `replaceRequestProperty` (per-property Express 5 `req.query`/`req.params`/`req.body` replacement — see its docstring for a real bug this project shipped and fixed around `req.query`'s getter).
- `src/health/` — liveness/readiness endpoint (`GET /health`, unversioned).
- `src/api/v1/` — the versioned route-mount point.
- `src/modules/users/` — the `User` model + repository + service. Other modules depend on `UsersService`, never the repository directly.
- `src/modules/auth/` — Identity & Access Management: registration, email verification, login, refresh-token rotation, logout, password reset, RBAC (`authenticate`/`requireRole`). See `docs/ARCHITECTURE.md` §6 for the full design.
- `src/modules/audit/` — `AuditLog` model/repository, extracted out of `modules/auth/` in the Menu phase once a second module (`menu`) needed to write audit entries. `AuditLogService` is the sole public interface — every module writes through it, never `AuditLogRepository` directly. See `docs/ARCHITECTURE.md` §3.1's "`modules/audit`" note.
- `src/modules/canteens/` — the first business/domain module: full CRUD + soft delete + status toggle, admin/super_admin-only mutations, student/kitchen_staff view-only, `authenticate`/`requireRole` consumed from `modules/auth` (never modified).
- `src/modules/menu/` — categories and items for a canteen's menu (`MenuCategory` + `MenuItem`, two sibling entities of one module — see `docs/ARCHITECTURE.md` §3.1's note on why they're allowed to depend on each other's repository). Admin/super_admin-only mutations, any authenticated role can read. Every mutation writes an audit log via `modules/audit`.
- `src/modules/orders/` — full order lifecycle (`Order` + `OrderItem`, populated into the previously-empty `orders/` scaffold slot). Students place/view/cancel their own orders; kitchen staff/admin/super_admin view a canteen's orders and advance status; a student may only cancel their own order while `pending`. Server computes all pricing from live menu-item prices — never from the client. See `docs/ARCHITECTURE.md` §3.1's `modules/orders` note for the no-transaction write ordering and the two-endpoint status/cancel split.
- `src/modules/` (remaining empty-scaffold folders: `admin`, `catalog`, `delivery`, `notifications`, `payments`, `restaurants`, `reviews`) — leftover from the original marketplace sketch; not yet reconciled with the campus-canteen direction (see `docs/DATABASE_DESIGN.md`'s scope note).

## Common commands

```bash
npm run dev             # ts-node-dev, hot reload
npm run build             # tsc + path-alias rewrite -> dist/
npm run start               # run the built dist/server.js
npm run lint                 # eslint
npm run test                  # jest (unit + integration; DB-backed tests use mongodb-memory-server, no external DB required)
npm run test:coverage          # jest --coverage
```

## Endpoints that exist today

- `GET /health` — liveness/readiness check.
- `GET /api-docs` — Swagger UI (every module below documents itself via `@openapi` JSDoc comments on its route definitions — see e.g. `modules/canteens/canteens.routes.ts`).
- `POST /api/v1/auth/register`, `/verify-email`, `/login`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password`, `GET /api/v1/auth/me`.
- `POST /api/v1/canteens`, `GET /api/v1/canteens`, `GET /api/v1/canteens/:id`, `PUT /api/v1/canteens/:id`, `DELETE /api/v1/canteens/:id` (soft delete), `PATCH /api/v1/canteens/:id/status`.
- `POST /api/v1/canteens/:canteenId/categories`, `GET /api/v1/canteens/:canteenId/categories`, `GET /api/v1/categories/:id`, `PUT /api/v1/categories/:id`, `DELETE /api/v1/categories/:id` (soft delete, `?force=true` cascades to active items), `PATCH /api/v1/categories/:id/reorder`.
- `POST /api/v1/canteens/:canteenId/menu-items`, `GET /api/v1/canteens/:canteenId/menu-items` (filters: `search`, `categoryId`, `isVeg`, `isAvailable`, `isFeatured`, `priceMin`/`priceMax`, sort), `GET /api/v1/menu-items/:id`, `PUT /api/v1/menu-items/:id`, `DELETE /api/v1/menu-items/:id` (soft delete), `PATCH /api/v1/menu-items/:id/availability`, `PATCH /api/v1/menu-items/:id/featured`, `PATCH /api/v1/menu-items/:id/reorder`.
- `POST /api/v1/canteens/:canteenId/orders` (student places an order), `GET /api/v1/orders/:id`, `GET /api/v1/students/me/orders` (student's own history, filters: `orderNumber`, `status`, `dateFrom`/`dateTo`, sort), `GET /api/v1/canteens/:canteenId/orders` (kitchen queue view, adds a `studentId` filter), `PATCH /api/v1/orders/:id/status` (forward pipeline only), `PATCH /api/v1/orders/:id/cancel`.

## Environment

Copy `.env.example` to `.env` before running — every variable has a safe development default (see `config/env.ts`), but production refuses to start with placeholder secrets. Requires a running MongoDB (`docker compose up -d mongo` from the repo root, or a real `MONGO_URI`) — `server.ts` connects at bootstrap and refuses to start accepting traffic until that succeeds.
