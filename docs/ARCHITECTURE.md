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
  <module>.validation.ts    → request schema validation (Zod/Joi)
  <module>.types.ts         → module-local TypeScript types/interfaces
```

**Layering rule:** `routes → controller → service → repository → model`. A controller never talks to a model directly; a service never builds an HTTP response. This separation is what keeps business logic unit-testable without spinning up Express.

### 3.2 Middleware Pipeline

Applied in a fixed, predictable order on protected routes:

1. **Request ID / correlation ID** injection (for tracing across logs)
2. **Authentication** — verifies JWT, attaches `req.user`
3. **Authorization (RBAC)** — checks `req.user.role` against route's required role(s)
4. **Validation** — schema-validates `body`/`params`/`query` before the controller ever sees them
5. **Rate limiting** — applied globally, with stricter limits on sensitive routes (OTP, order creation, payment)
6. **Controller execution**
7. **Centralized error handler** — every thrown error (including validation/auth failures) resolves to the standard error envelope defined in [API_SPECIFICATION.md](./API_SPECIFICATION.md)

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

- All configuration read from environment variables through a single validated config module (fails fast at boot if a required variable is missing — never fails silently at first use).
- Three environments: `development`, `staging`, `production`, each with isolated MongoDB database, Redis instance, and Razorpay key set (test keys in dev/staging, live keys only in production).

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

- JWT stored in an **httpOnly, secure, SameSite cookie** (not `localStorage`) to reduce XSS token-theft exposure — a deliberate difference from the mobile app's secure-storage approach, appropriate to the web threat model.
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

```
1. Client requests OTP           → POST /auth/otp/request {phone}
2. Server generates OTP, stores  → Redis, TTL 5 min, rate-limited per phone
3. Client submits OTP            → POST /auth/otp/verify {phone, otp}
4. Server verifies, issues       → access token (15 min) + refresh token (30 days)
5. Refresh token stored          → hashed, in MongoDB, associated with device/session
6. Client stores tokens          → secure storage (mobile) / httpOnly cookie (web)
7. Subsequent requests           → Authorization: Bearer <access_token>
8. On 401 (expired access token) → client calls /auth/refresh with refresh token
9. Server validates refresh      → rotates it (old one invalidated, new one issued)
10. Logout / logout-everywhere   → refresh token(s) revoked server-side
```

**Role determination:** the JWT payload carries `userId` and `role`, but **role is re-verified against the database on every sensitive action**, not trusted blindly from an old token — this protects against a role change (e.g., restaurant suspended) not taking effect until token expiry.

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
