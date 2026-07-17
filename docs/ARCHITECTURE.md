# QBite — System Architecture

**Status:** Foundational reference. Changes to this document require the same review rigor as an architecture decision record — update it in the same PR that changes the structure it describes.
**Related documents:** [`QBite_SRS_PRD.md`](../QBite_SRS_PRD.md) (product scope), [`DATABASE_DESIGN.md`](./DATABASE_DESIGN.md), [`API_SPECIFICATION.md`](./API_SPECIFICATION.md)

---

## 1. Overall System Architecture

QBite is a **monorepo, modular-monolith** system composed of three client-facing surfaces sharing one backend and one database. The system is intentionally *not* microservices at this stage — see [Design Principles §9.2](#92-modular-monolith-over-microservices) for the reasoning.

### 1.1 Components

| Component | Role |
|---|---|
| **QBite Mobile App** (Flutter) | Customer-facing ordering app. The only mobile client in v1. |
| **QBite Admin Panel** (Next.js) | Web app serving two role-scoped surfaces: Restaurant Partner dashboard and Platform Admin console. |
| **QBite API** (Node.js/Express) | Single backend serving both clients over REST + WebSocket. Modular monolith internally. |
| **MongoDB Atlas** | System of record. |
| **Redis** | Session/OTP cache, Socket.IO horizontal-scaling adapter, BullMQ job queue backing store. |
| **Razorpay** | Payment processing (checkout + webhooks + refunds). |
| **Firebase Cloud Messaging (FCM)** | Push notification delivery, primary channel when the app is backgrounded/killed. |
| **CDN (Cloudinary / S3+CloudFront)** | Static asset delivery (menu photos, restaurant banners, proof-of-delivery images). |

### 1.2 High-Level Diagram

```
                        ┌────────────────────┐        ┌─────────────────────┐
                        │   QBite Mobile      │        │   QBite Admin Panel  │
                        │   (Flutter)          │        │   (Next.js)           │
                        │   - Customers          │        │   - Restaurant Partners│
                        │                        │        │   - Platform Admins    │
                        └──────────┬─────────────┘        └───────────┬───────────┘
                                   │  REST (Dio) + WSS                 │  REST + WSS
                                   └───────────────┬────────────────────┘
                                                    │
                                       ┌────────────▼─────────────┐
                                       │   QBite API (Express)      │
                                       │   ─────────────────────    │
                                       │   Middleware pipeline:      │
                                       │   auth → rbac → validate →  │
                                       │   rate-limit → controller   │
                                       │                              │
                                       │   Modules: auth, users,      │
                                       │   restaurants, catalog,      │
                                       │   orders, payments,          │
                                       │   delivery, notifications,   │
                                       │   reviews, admin              │
                                       │                              │
                                       │   Socket.IO namespace        │
                                       │   BullMQ workers              │
                                       └───┬───────┬───────┬─────────┘
                                           │       │       │
                          ┌────────────────┘       │       └────────────────┐
                          │                         │                        │
                ┌─────────▼─────────┐    ┌──────────▼──────────┐   ┌─────────▼─────────┐
                │   MongoDB Atlas     │    │   Redis                │   │  External Services  │
                │   (system of record)│    │   (cache/queue/socket  │   │  Razorpay, FCM, CDN  │
                │                      │    │   adapter)              │   │                       │
                └──────────────────────┘    └─────────────────────────┘   └───────────────────────┘
```

### 1.3 Client-to-Backend Contract

Both clients (mobile and admin) talk to **the same API** — there is no separate "admin API." Role-based access control (RBAC) at the middleware layer determines what a given authenticated user can see or do. This avoids duplicating business logic across two backends and keeps a single source of truth for validation rules, pricing logic, and state transitions.

---

## 2. Mobile Architecture (Flutter)

### 2.1 Pattern: Feature-First Clean Architecture

Each feature is a vertical slice with three internal layers. Dependencies point inward — `presentation` depends on `domain`, `data` depends on `domain`, but `domain` depends on nothing outside itself. This is what makes business logic (domain layer) testable without a UI or a network connection.

```
feature/
  data/
    datasources/     → remote (Dio calls) and local (cache) data sources
    models/           → DTOs — JSON (de)serialization, extend/map to domain entities
    repositories/     → concrete repository implementations
  domain/
    entities/          → plain Dart objects, no JSON/annotation knowledge
    repositories/       → abstract repository interfaces (contracts)
    usecases/            → single-responsibility application logic units
  presentation/
    providers/            → Riverpod providers (state + notifiers)
    screens/                → route-level widgets
    widgets/                 → feature-scoped reusable widgets
```

### 2.2 State Management — Riverpod

- **Providers are the single source of truth** for feature state; widgets are dumb renderers of provider state, never holders of business state themselves.
- State is modeled explicitly (`AsyncValue<T>` for anything async) so every screen has a mechanical mapping to loading / data / error UI — no ad hoc boolean flags for "isLoading."
- Providers are scoped as narrowly as possible (feature-level, not global) to avoid unnecessary rebuilds and to keep features independently testable/removable.
- Cross-feature state (auth session, current user, active cart) lives in a small set of **app-level providers** consumed by multiple features — kept deliberately minimal to avoid becoming a shared mutable-state dumping ground.

### 2.3 Routing — GoRouter

- Centralized route table in `config/router.dart` (declarative, not imperative navigation).
- Route guards (redirect logic) enforce auth state — unauthenticated users are redirected to the auth flow before reaching protected routes.
- Deep links are a first-class concern from day 1: order-tracking and order-confirmation screens must be reachable directly from an FCM notification tap, not only via in-app navigation.

### 2.4 Networking — Dio

- One configured `Dio` instance per app, injected via a provider — not instantiated ad hoc in feature code.
- Interceptor chain (fixed order): **auth header injection → response logging (debug only) → error normalization → auth-refresh-on-401 retry**.
- All network errors are normalized into a single app-level `Failure` type before reaching the presentation layer — screens never handle raw `DioException`.

### 2.5 Local Persistence

- **Secure storage** (e.g., `flutter_secure_storage`) for JWT access/refresh tokens — never `SharedPreferences` for tokens.
- Lightweight local cache (e.g., Hive or plain SharedPreferences) for non-sensitive UX state: last-used address, recently viewed restaurants.

### 2.6 Error & Empty State Handling

Every screen that depends on async data must render four possible states: **loading, data, empty, error**. This is a hard rule, not a suggestion — see [CODING_STANDARDS.md](./CODING_STANDARDS.md) for enforcement.

---

## 3. Backend Architecture (Node.js / Express)

### 3.1 Pattern: Modular Monolith

The backend is one deployable service, internally partitioned into **feature modules** with strict internal layering. A module may only be imported by another module through its public interface (its `service`), never by reaching into another module's `model` or `repository` directly. This boundary discipline is what makes future extraction into a separate service (if ever needed) a refactor, not a rewrite.

```
module/
  <module>.routes.ts        → route definitions, wires middleware + controller
  <module>.controller.ts    → HTTP layer only: parse request, call service, shape response
  <module>.service.ts       → business logic, orchestrates repository + external calls
  <module>.repository.ts    → data-access layer, all MongoDB queries live here
  <module>.model.ts         → Mongoose schema/model definition
  <module>.validation.ts    → request schema validation (Zod)
  <module>.types.ts         → module-local TypeScript types/interfaces
```

**Layering rule:** `routes → controller → service → repository → model`. A controller never talks to a model directly; a service never builds an HTTP response. This separation is what keeps business logic unit-testable without spinning up Express.

**Sibling entities within one module** (Menu phase, `modules/menu/` — `MenuCategory` + `MenuItem`): the module boundary is drawn at `modules/menu`, not at the individual entity. `MenuCategoriesService` and `MenuItemsService` are each other's sibling and are permitted to depend on the *other entity's repository* directly (e.g. `MenuCategoriesService` calls `MenuItemsRepository.existsActiveInCategory` to enforce its delete guard; `MenuItemsService` calls `MenuCategoriesRepository.findById` to validate a category exists and belongs to the right canteen). This is a deliberate exception to "a service only touches its own repository" — the alternative, each depending on the *other's service*, creates a real circular dependency (`new MenuCategoriesService()`'s default constructor building a `MenuItemsService()`, which defaults to building a `MenuCategoriesService()`, ...). Reaching into a sibling's repository — never its service, and never across an actual module boundary — avoids the cycle while keeping the rule's real purpose (nothing *outside* `modules/menu` touches `MenuCategoryModel`/`MenuItemModel` directly) intact.

**`modules/audit`** (extracted from `modules/auth` during the Menu phase): `AuditLog` originated inside `auth` as its only producer, with the model/repository documented at the time as "extractable later if broader audit logging is needed across other modules." Once `menu` needed to write audit entries too, leaving `AuditLog` inside `auth` would have forced `menu` to either duplicate the collection or reach into `auth`'s internals — both violate this section's boundary rule. `modules/audit/audit-log.service.ts` is now the sole public interface (`auth` and `menu` both depend on it, never on `AuditLogRepository`); the "an audit-logging failure must never break the caller's business operation" try/catch, previously duplicated inline in `auth.service.ts`, now lives once in `AuditLogService.record()` so every future caller gets it for free.

**Cross-cutting infrastructure lives in its own top-level folder, one concern each** — added during the backend-core-infrastructure phase, alongside `config/, modules/, middlewares/, jobs/, sockets/, utils/, tests/`:

```
src/
  errors/        → AppError base class + one subclass per HTTP-status/error-code pairing (§3.2)
  validation/     → validateRequest(schemas) — generic Zod-based request-validation middleware factory
  context/         → AsyncLocalStorage-based request context (currently: requestId)
  logging/          → the pino logger instance (structured, request-ID-aware — see below)
  response/          → sendSuccess/sendPaginated — the response-envelope builders every route uses
  api/                → version-mount points (api/v1/index.ts today; api/v2/ added alongside it for a
                         breaking change, per API_SPECIFICATION.md §7 — v1 is never modified in place)
  health/               → the liveness/readiness endpoint (see §3.2's routes/controllers exception)
```

These are deliberately *not* folded into `utils/` — each is a single, named concern, not a miscellany bucket.

### 3.2 Middleware Pipeline

Two distinct pipelines, not one — conflating them was an earlier draft of this document's mistake, corrected once the infrastructure was actually built:

**Global pipeline** (`app.ts`, applied to every request, before any route is reached): `requestId → requestLogger → securityHeaders (helmet/hpp) → cors → defaultRateLimiter → compression → cookies → body parsing → sanitizeInput (NoSQL-injection guard) → route mounts (/health, /api-docs, /api/v1) → notFound → errorHandler`. `errorHandler` is always last; every thrown error — from any layer, including the ones below — resolves to the standard error envelope defined in [API_SPECIFICATION.md](./API_SPECIFICATION.md) §5.

**Per-route pipeline** (layered on top of the global chain by each module as it's built, not part of `app.ts`):

1. **Authentication** — verifies JWT, attaches `req.user`
2. **Authorization (RBAC)** — checks `req.user.role` against the route's required role(s)
3. **Validation** — `validateRequest({ body, params, query })` (see `validation/`) — schema-validates before the controller ever sees the request, replacing `req.body`/`req.params`/`req.query` with the parsed, typed result
4. **Stricter rate limiting** where warranted (e.g. OTP request) — `middlewares/rate-limiter.middleware.ts`'s `createRateLimiter(...)`, layered on top of the global default
5. **Controller execution** — wrapped in `catchAsync` (`utils/async-handler.ts`) so a rejected promise reaches `errorHandler` instead of hanging

**Request correlation:** `requestId` (global step 1) generates or reuses an inbound `X-Request-Id` header via `crypto.randomUUID()` (no dependency needed — built into Node 20+) and runs the rest of the request inside `context/request-context.ts`'s `AsyncLocalStorage`. The logger's `mixin` reads that context on every log call, so a request ID appears on every log line for that request — including from code several calls deep — without being passed as a parameter anywhere.

**Logging:** `pino`, not `morgan`. JSON output (what a log aggregator expects) in every environment except `development` (pretty-printed via `pino-pretty`) and `test` (silent — test/CI output should be signal, not noise). `morgan`'s plain-text, non-correlated access log was removed in favor of this.

**Errors:** `errors/app-error.ts` defines `AppError` (statusCode, code, message, details, isOperational); `errors/http-errors.ts` has one subclass per status/code pairing in API_SPECIFICATION.md §5.1 (`BadRequestError`, `NotFoundError`, `ConflictError`, ...). A module throws these directly; `middlewares/error-handler.middleware.ts` maps them to the envelope and decides — via `isOperational` — whether `message`/`details` are safe to expose to the client in production, or whether to return a generic message and rely on the logged stack trace instead.

**Security:** `helmet` + `hpp` run globally, early. NoSQL-injection sanitization (`sanitizeInput`, in `middlewares/security.middleware.ts`) is a **hand-rolled** ~20-line middleware, not the commonly-used `express-mongo-sanitize` package — that package reassigns `req.query` wholesale, which throws under Express 5 (`req.query` is a getter with no setter as of Express 5; confirmed by running it, not just reading about it).

**`req.query` under Express 5 — a real bug found and fixed, not just a workaround:** the initial fix (mutating the existing object's own keys in place, in `utils/replace-request-property.ts`) avoided the "only a getter" throw but didn't actually work — Express 5's `req.query` getter **re-parses the raw query string on every access** rather than returning a cached object, so any in-place mutation is silently discarded the next time anything reads `req.query`. This meant `sanitizeInput`'s query sanitization never reached a route handler, and `validateRequest`'s parsed/defaulted query values (pagination defaults, filters, coerced types) were invisible to controllers — both shipped broken and undetected during the IAM phase because the only test coverage checked "the request doesn't crash," never "does a downstream handler see the replaced value." It surfaced once `GET /canteens` (the Canteen phase) became the first endpoint to actually read a validated query param back. The real fix: `replaceRequestProperty` now takes `(req, key, value)` and, for `query` specifically, shadows the getter with `Object.defineProperty(req, 'query', { value, ... })` — a per-request property override, not a prototype change. `params`/`body` (plain data properties, not getters) keep the original in-place-mutation approach, which was always correct for them.

### 3.3 Asynchronous Work — BullMQ (Redis-backed)

Work that does not need to block the HTTP response is pushed to a queue, not executed inline:

- Notification fan-out (FCM dispatch)
- Payout ledger calculation
- Receipt/invoice generation
- Payment-reconciliation sweep (catches orders stuck in `PAYMENT_PENDING` — see [ARCHITECTURE.md §5](#5-authentication-flow) → payments note)

This keeps request/response latency predictable and isolates slow/flaky third-party calls (FCM, email) from the critical order-creation path.

### 3.4 Real-Time Layer — Socket.IO

- Runs as part of the same Express process, attached to the same HTTP server.
- **Redis adapter is mandatory**, not optional — without it, events emitted from one Node instance never reach a client connected to a different instance, which silently breaks live tracking the moment the backend scales beyond one process.
- Rooms are scoped per `orderId`; a client joins a room only for orders it is a participant in (customer, assigned delivery partner, restaurant). No global broadcast for order events.

### 3.5 Configuration & Environments

- All configuration read from environment variables through `config/env.ts` — a single Zod schema (`envSchema.safeParse(process.env)`), validated once at import time. A missing or malformed variable crashes the process immediately with an itemized list of every problem found, not just the first one, and not silently at first use. Zod is used here for the same reason it's used for request validation (`validation/`) — one schema-validation approach for both jobs, not two libraries doing the same thing.
- Four `NODE_ENV` values: `development`, `staging`, `production`, and `test` (the last used only by the Jest suite — see §3.2's note on `logging/`). `development`/`staging`/`production` each get an isolated MongoDB database, Redis instance, and Razorpay key set (test keys in dev/staging, live keys only in production).
- Dev-convenience defaults (e.g. a placeholder JWT secret so a fresh clone can boot without configuring secrets first) are rejected at boot if `NODE_ENV=production` — a production process refuses to start with a placeholder secret rather than silently running insecurely.

---

## 4. Admin Dashboard Architecture (Next.js)

### 4.1 Two Role-Scoped Surfaces, One App

The admin panel serves both **Restaurant Partners** and **Platform Admins** from a single Next.js deployment, separated by route groups and enforced server-side, not just hidden client-side:

```
app/
  (restaurant)/       → route group: restaurant-partner-scoped pages
  (platform-admin)/   → route group: platform-admin-scoped pages
  (auth)/              → login/shared auth pages
```

- Every route in a role-scoped group re-validates the user's role server-side (middleware/layout-level guard) — a restaurant partner must never be able to reach a platform-admin route by guessing a URL.
- Data queries are additionally scoped at the repository/service layer on the backend (a restaurant partner's token can only ever fetch that restaurant's data, regardless of what the frontend requests) — defense in depth, not reliance on UI hiding alone.

### 4.2 Rendering Strategy

- **Server Components** by default for data-heavy dashboard views (order history, analytics, menu lists) — reduces client JS and keeps data-fetching close to the backend.
- **Client Components** only where interactivity requires it: live order queue (Socket.IO subscription), forms, real-time toggles (store open/close).
- No global client-side state library needed for v1 — server-driven data + local component state + a thin real-time layer (Socket.IO client) covers the admin panel's needs without over-engineering.

### 4.3 Auth Handling (Web-Specific)

- **The refresh token**, specifically — not the access token — is what's stored in an **httpOnly, secure, SameSite cookie** (not `localStorage`), to reduce XSS token-theft exposure. The access token is short-lived (15 min) and kept in memory, attached to each request via `Authorization: Bearer`, the same as the mobile client — cookies aren't a natural fit for a stateless bearer token used identically across platforms. This corrects an earlier, vaguer version of this section that just said "JWT stored in a cookie" without distinguishing the two tokens.
- Mobile has no equivalent cookie story with Dio/`flutter_secure_storage`, so the refresh token is *also* returned in the JSON response body — the backend delivers it both ways from the same endpoint, and each client uses whichever mechanism fits it. See [§6](#6-authentication-flow).
- Middleware-level session check on every protected route before render.

---

## 5. Communication Flow

| Interaction | Protocol | Why |
|---|---|---|
| Browsing, cart, checkout, admin CRUD | REST over HTTPS | Standard request/response, cacheable, stateless. |
| Order status changes, live delivery-partner location | WebSocket (Socket.IO) | Low-latency, server-push, avoids polling. |
| Order status when app is backgrounded/killed | FCM push | Socket connection doesn't exist when the app isn't running; FCM is the only reliable channel in that state. |
| Payment confirmation | Razorpay server-to-server webhook (signature-verified) | Client-reported payment success is never trusted as the source of truth — see §6. |
| Image delivery | CDN (direct client fetch, not proxied through API) | Keeps the API server off the critical path for static asset bandwidth. |

**Rule of thumb:** REST for anything triggered by explicit user action; Socket.IO for anything the server needs to push proactively while the app is open; FCM for anything that must reach the user regardless of app state.

---

## 6. Authentication Flow

Implemented by the `auth` + `users` modules (Identity & Access Management phase). Supersedes an earlier draft of this section that sketched a phone-OTP-*login* flow — the actual design is password-based login with OTP used only for one-time email verification at registration, per `docs/QBite_SRS_PRD.md`'s IAM requirements.

### 6.1 Registration → Verification → Login

```
1. POST /auth/register {usn, fullName, collegeEmail, phoneNumber, password}
   → role is always "student" (never client-supplied — see §9.1)
   → password hashed with bcrypt (12 rounds), account created with isEmailVerified: false
   → a 6-digit OTP is generated, bcrypt-hashed (10 rounds), stored with a 10-minute expiry
   → OTP emailed to collegeEmail (EmailService — see §6.5)
2. POST /auth/verify-email {collegeEmail, otp}
   → compares against the stored hash; wrong/expired/exhausted-attempts all return
     the same generic error (enumeration resistance — see §6.4)
   → on success: isEmailVerified: true. The account still cannot log in until this step.
3. POST /auth/login {identifier, password}   — identifier is USN or collegeEmail
   → checked, in this order, so a locked account never leaks whether the
     supplied password happens to be correct: account lock status → password
     match → email-verified → active
   → on success: access token (JWT, 15 min) + refresh token (opaque random
     string, 30 days) issued — see §6.2
```

### 6.2 Access Tokens vs. Refresh Tokens

Two different token types for two different jobs, not the same mechanism twice:

- **Access token** — a stateless JWT (`sub`, `role`), signed with `JWT_ACCESS_SECRET`, 15-minute expiry. Verified without a database hit (fast, scales horizontally with zero shared state) — except `middlewares` further up the request re-fetch the user anyway (see §6.3), so the "no DB hit" property is really about signature/expiry verification being cheap, not the full auth check being free.
- **Refresh token** — an opaque, high-entropy random string (`crypto.randomBytes(32)`), **not a JWT**. Only its SHA-256 hash is ever stored (`refresh_tokens` collection, see `DATABASE_DESIGN.md` §2.10). This is what makes real revocation and a blacklist strategy possible at all — a stateless JWT refresh token can't be un-issued before it expires; a DB-tracked opaque one can.

### 6.3 `authenticate` Middleware — Re-Verifies Against the Database Every Time

The JWT payload carries `userId` and `role`, but **the user is re-fetched from MongoDB on every authenticated request** — role is never trusted blindly from the token. This is what makes a role change or account deactivation take effect within one request, not only after the old token expires. Two additional checks happen on every request beyond "is the signature valid":

- `user.isActive` — a deactivated account's outstanding access tokens stop working immediately.
- `user.passwordChangedAt` vs. the token's `iat` — a token issued *before* the user's last password change is rejected even though it hasn't expired yet. This is how a password reset achieves effective access-token revocation without needing a separate access-token blacklist (the refresh-token blacklist in §6.4 doesn't help here, since the access token is what's actually being presented).

### 6.4 Refresh Rotation, Reuse Detection, and Revocation

```
POST /auth/refresh {refreshToken?}   — from httpOnly cookie (web) or body (mobile)
  → hash the presented token, look up refresh_tokens by tokenHash
  → if the matched record is already revoked: this is a REUSE of a token that
    was already rotated past — treat as a compromise signal, revoke every
    token sharing its familyId, force re-login on every device in that family
  → otherwise: revoke the presented token (recording it as replaced by the
    new one), issue a new access+refresh pair under the SAME familyId
```

Every login starts a new `familyId`; every `/auth/refresh` call continues the existing family. This is the OWASP-recommended rotation-with-reuse-detection pattern, not a homegrown scheme.

**Revocation triggers**, beyond normal expiry:
- `POST /auth/logout` — revokes the one presented token (single session/device). Always returns success regardless of whether the token was valid, so logout can't be used to probe token validity.
- `POST /auth/reset-password` — revokes **every** refresh token for the user (all sessions, all devices) — a password reset is treated as a strong enough signal to kill any possibly-stolen session, not just the one being used to reset.
- Reuse detection (above) — revokes the entire token family, not just the reused token.

**Enumeration resistance:** wrong-password and unknown-identifier return the identical `INVALID_CREDENTIALS` error at login; `forgot-password` always returns the same generic response whether or not the email is registered; `verify-email` collapses "unknown email," "OTP expired," and "OTP wrong" into one generic error. Registration's uniqueness conflict (`EMAIL_ALREADY_REGISTERED` etc.) is the one accepted exception — a real user has to be told their email is taken.

**Account lockout** is a second, independent layer from IP-based rate limiting (§3.2): 5 failed password attempts locks the *account* for 15 minutes regardless of source IP, which IP-based limiting alone can't stop (an attacker spreading attempts across many IPs).

### 6.5 Email Delivery

No email provider is chosen anywhere in this project's stack — `EmailService` is an interface (`modules/auth/email.service.ts`) with one real, working implementation today (`LoggingEmailService`, which logs the message via the structured logger instead of sending it), so the full registration/verification/reset flow is genuinely testable without a provider decision or credentials. Swapping in a real provider later means implementing `EmailService` once and changing where it's constructed — nothing about the auth flow itself changes.

**Payment note (data-flow-adjacent to auth):** the same "never trust the client" principle governs payments — an order is only marked `paid` when Razorpay's signed webhook confirms it server-to-server, never from the client's post-payment callback alone (that callback only improves perceived UI latency, e.g. showing a "processing" state).

---

## 7. Data Flow (Order Lifecycle — End to End)

```
Cart (client-side only, not persisted)
  → POST /orders/preview        [server recalculates pricing from live menu + coupon rules]
  → POST /orders                 [creates order in PAYMENT_PENDING, returns Razorpay order id]
  → Razorpay Checkout             [client completes payment]
  → Razorpay webhook              [server verifies signature, marks order PLACED]
  → Socket.IO emit                [order_status_changed → customer + restaurant rooms]
  → FCM push                       [redundant delivery for backgrounded app]
  → Restaurant accepts/preps       [PATCH /orders/:id/accept, /status → PREPARING → READY_FOR_PICKUP]
  → Delivery partner assigned       [manual in v1 → PATCH /orders/:id/pickup]
  → Live location updates            [Socket.IO partner_location_update, throttled]
  → Delivery confirmed                [PATCH /orders/:id/deliver, OTP/photo proof]
  → Order → DELIVERED, rating prompt triggered client-side
```

Every state transition is appended to the order's `statusHistory` (see [DATABASE_DESIGN.md](./DATABASE_DESIGN.md)) — the order document is both the current state and its own audit log.

---

## 8. Folder Structure (Repository-Level)

QBite is an **`apps/` + `packages/` monorepo** (npm workspaces) — one Git repository, three deployable applications, three shared (currently empty) packages, shared documentation. This supersedes an earlier flat `mobile/backend/admin/` sketch from this document's first draft; separating deployable apps from shared, non-deployable code is the standard shape once a repo expects to share TypeScript code between two of its surfaces.

```
qbite/
  apps/
    mobile/                    → Flutter customer app (feature-first, see §2.1) — not an npm workspace
    backend/                   → Node/Express/TypeScript API (modular monolith, see §3.1)
      src/
        config/
        modules/
        middlewares/
        jobs/
        sockets/
        utils/
        tests/
    admin/                      → Next.js admin panel (see §4.1)
      src/
        app/
          (restaurant)/
          (platform-admin)/
          (auth)/
        components/
        lib/
        hooks/
        types/
  packages/
    shared-types/                → TypeScript types shared between backend ↔ admin
    shared-utils/                 → Framework-agnostic shared utilities
    api-contracts/                 → Shared API contract source (schemas, error codes) — see API_SPECIFICATION.md
  docs/                             → this documentation set
  scripts/                          → dev environment scripts (setup, clean, lint-all, docker-services)
  docker/                           → Dockerfile placeholders + docker-compose.yml
  .github/
    workflows/                      → CI pipelines (per-app, path-filtered) — folder present, no workflows added yet
  QBite_SRS_PRD.md
  README.md
```

**Why `apps/mobile` is not an npm workspace:** npm workspaces (and the root `package.json`) only list `apps/backend`, `apps/admin`, and `packages/*` — Flutter/Dart has its own dependency manager (`pub`) and cannot participate in an npm workspace. `apps/mobile` lives alongside the JS/TS apps for monorepo colocation (single repo, single PR can touch mobile + backend together) but is dependency-managed independently via `flutter pub get`.

**Path-filtered CI (planned):** each app's pipeline will trigger only on changes within its own directory, so a docs-only or mobile-only change doesn't waste CI minutes rebuilding the backend and vice versa — not yet implemented, since `.github/workflows/` is intentionally empty during the engineering-foundation phase.

**On `packages/*`:** scaffolded now (package.json + placeholder `src/index.ts` per package) so the workspace structure and TypeScript project references are provable/buildable from day one, but deliberately left empty of real exports. Real types/utilities/contracts move in only once genuine duplication exists between `apps/backend` and `apps/admin` — populating them speculatively would be exactly the kind of premature abstraction this project avoids.

---

## 9. Design Principles

### 9.1 Server Is the Source of Truth

Pricing, discounts, role permissions, and payment status are always computed/verified server-side. Client input is a request, never a fact. This single principle prevents the majority of real-world food-delivery-app fraud vectors (fake discounts, price tampering, self-reported payment success).

### 9.2 Modular Monolith Over Microservices

At QBite's current and near-term scale, microservices would add distributed-systems complexity (network calls where function calls used to be, distributed tracing, eventual-consistency bugs, multiplied deployment/ops surface) without a corresponding scaling benefit. The modular monolith gets the main benefit people actually want from microservices — enforced module boundaries — without the operational tax. Extraction into a real service is a valid *future* move, made only when a specific module demonstrably needs independent scaling or a separate release cadence (see [DATABASE_DESIGN.md §5](./DATABASE_DESIGN.md) for how this affects data-layer decisions).

### 9.3 Statelessness

The API server holds no in-memory session state that would break horizontal scaling — session/auth state lives in the JWT + Redis, not in server memory. Any request can be served by any instance.

### 9.4 Fail Fast, Fail Loud

Configuration errors, missing environment variables, and schema-validation failures surface immediately and explicitly (at boot or at the request boundary) — never silently default to a "probably fine" value.

### 9.5 Idempotency Where It Matters

Order creation and payment webhook processing are designed to be safely retryable — a network retry or a duplicate webhook delivery must never create a duplicate order or double-process a payment.

### 9.6 Separation of Concerns at Every Layer

Mobile: presentation never contains business logic. Backend: controllers never contain business logic; repositories never contain business logic. Business logic lives in exactly one place per platform (`usecases`/providers on mobile, `service` on backend) — this is what keeps the system testable and what keeps a future rewrite of *one* layer (e.g., swapping REST for GraphQL) from requiring a rewrite of everything above it.

### 9.7 Security by Default, Not by Addition

Auth, validation, and rate-limiting are default middleware applied broadly and explicitly opted out of for public routes — not the other way around (opt-in security is how routes accidentally ship unprotected).

### 9.8 Build for the Team, Not Just the Feature

Every module follows the same internal shape (§3.1) regardless of how small the feature is. Consistency across modules is worth more long-term than a locally "cleaner" one-off structure — a new engineer should be able to predict a file's location without being told.
