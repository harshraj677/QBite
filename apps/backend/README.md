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
- `src/modules/kitchen/` — a pure delegation facade over `OrdersService` for kitchen_staff/admin/super_admin: a dashboard (`GET /kitchen/orders`, unscoped across every canteen — see the known kitchen_staff-canteen-scoping limitation above) plus four fixed-target status transitions. Contains no independent business logic — every rule (forward-only transitions, immutability, no pricing/item/payment access, no cancel capability) is inherited from `orders/` by calling the same `OrdersService` methods. See `docs/ARCHITECTURE.md` §3.1's `modules/kitchen` note, including the one modification made to already-completed code: `OrdersService.updateStatus` now logs a precise `order.accepted`/`order.preparing`/`order.ready`/`order.completed` audit action per transition (previously one generic `order.status_updated`) — required so Kitchen's endpoints don't have to double-log, and it improves the direct `PATCH /orders/:id/status` endpoint's audit trail too.
- `src/modules/notifications/` — in-app order-lifecycle notifications (no Firebase push yet), populated into the previously-empty `notifications/` scaffold slot. Every endpoint is self-scoped to the authenticated caller — no admin-any-user path exists. `NotificationsService.notifyOrderEvent(...)` is this module's public integration surface; `OrdersService` calls it from `placeOrder`/`updateStatus`/`cancelOrder` (a second, similarly-justified modification to already-completed code — see `docs/ARCHITECTURE.md` §3.1's `modules/notifications` note), so `modules/kitchen` needed zero changes to gain notifications on its four transition endpoints.
- `src/modules/payments/` — Razorpay integration (`Payment` model, `RazorpayClient` using native `fetch`, HMAC-SHA256 signature verification for both the `/verify` and `/webhook` flows), populated into the previously-empty `payments/` scaffold slot. Amount is always server-computed from `Order.totalAmount` — never accepted from a client. `POST /payments/verify` (synchronous, student-facing) and `POST /payments/webhook` (async, Razorpay-facing, no bearer token — authenticated by signature instead) share one private `PaymentsService.transitionPaymentStatus()` method, so both are idempotent by construction and the "update order → notify → audit" side effects are written exactly once. See `docs/ARCHITECTURE.md` §3.1's `modules/payments` note for the full design (including the one small, additive change to `app.ts`: `express.json()` now captures `req.rawBody`, required for verifying a webhook's signature against the exact bytes Razorpay sent).
- `src/modules/` (remaining empty-scaffold folders: `admin`, `catalog`, `delivery`, `restaurants`, `reviews`) — leftover from the original marketplace sketch; not yet reconciled with the campus-canteen direction (see `docs/DATABASE_DESIGN.md`'s scope note).

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
- `GET /api/v1/kitchen/orders` (dashboard, unscoped across canteens; filters: `status`, `orderNumber`, `pickupToken`; `sortOrder` asc/desc = oldest/newest first), `GET /api/v1/kitchen/orders/:id`, `PATCH /api/v1/kitchen/orders/:id/accept`, `PATCH /api/v1/kitchen/orders/:id/start-preparing`, `PATCH /api/v1/kitchen/orders/:id/ready`, `PATCH /api/v1/kitchen/orders/:id/complete` (all four: no request body).
- `GET /api/v1/notifications` (own notifications, filters: `isRead`, `sortOrder`), `GET /api/v1/notifications/unread-count`, `PATCH /api/v1/notifications/:id/read`, `PATCH /api/v1/notifications/read-all`, `DELETE /api/v1/notifications/:id` — all self-scoped, no admin override.
- `POST /api/v1/payments/create-order` (student, order owner only — creates a Razorpay order sized from the server-computed order total), `POST /api/v1/payments/verify` (student, order owner only — verifies Razorpay Checkout's HMAC signature, idempotent), `POST /api/v1/payments/webhook` (no auth — Razorpay server-to-server, authenticated by its own `X-Razorpay-Signature` HMAC instead; handles `payment.captured`/`payment.failed`/`refund.processed`, ignores anything else safely), `GET /api/v1/payments/order/:orderId`, `GET /api/v1/payments/:id`.

## Environment

Copy `.env.example` to `.env` before running — every variable has a safe development default (see `config/env.ts`), but production refuses to start with placeholder secrets. Requires a running MongoDB (`docker compose up -d mongo` from the repo root, or a real `MONGODB_URI` — an Atlas connection string in staging/production) — `server.ts` connects at bootstrap and refuses to start accepting traffic until that succeeds. `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`/`RAZORPAY_WEBHOOK_SECRET` follow the same pattern — a Razorpay Test Mode dashboard's keys are safe to use locally; production refuses to start if any of the three is still a placeholder.
