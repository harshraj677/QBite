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

**`modules/orders`** (Order Management phase) depends on three other modules' public services in the same request — `CanteensService` (the canteen exists), `MenuItemsService` (each ordered item exists, is available, belongs to the right canteen), `MenuCategoriesService` (the item's category name, for `itemSnapshot`) — all through their service, never a repository, per this section's rule. Two decisions specific to this module:

- **No multi-document transaction for the two-collection write** (`orders` + `order_items`). This project has never used MongoDB transactions (mongodb-memory-server's default standalone test instance doesn't support them, and no prior module needed one), so rather than introduce that machinery for a single call site, `OrdersService.placeOrder` pre-generates the `Order`'s `_id` and writes `order_items` *first*, referencing that id. If that write fails, no `Order` document exists yet, so nothing needs cleaning up. The `Order` itself is written *last*, since it's the only side with a uniqueness constraint that can collide (`orderNumber`/`pickupToken`) — a collision there is a safe, side-effect-free retry with fresh values, because the already-written items never need to change.
- **Two separate mutation endpoints for one status field** (`PATCH /orders/:id/status` vs `PATCH /orders/:id/cancel`), not one endpoint accepting any target status. `status` only moves forward through `orders.constants.ts`'s `FORWARD_TRANSITIONS` map (`pending → accepted → preparing → ready → completed`); `cancelled` is deliberately unreachable through that map. This guarantees there is exactly one code path that can ever cancel an order, with its own authorization rule (a student may cancel their own order only while `pending`; staff/admin may cancel any order that hasn't reached a terminal state) that the forward-pipeline endpoint doesn't need to reason about at all.

**Known limitation, not yet addressed:** `kitchen_staff` accounts are not scoped to a specific canteen — no such field exists on the `users` model (see `docs/DATABASE_DESIGN.md` §2.1's IAM-phase scope note). `GET /canteens/:canteenId/orders` and `PATCH /orders/:id/status` are therefore reachable by *any* `kitchen_staff` account for *any* canteen, not just one they're assigned to. Adding that assignment would mean modifying the `users` module, which this phase's constraints ("do not modify previous modules unless absolutely required") explicitly rule out for a feature that isn't required to make Orders work — flagged here so the gap stays visible for a future IAM-extension phase. This same unscoped-by-canteen behavior is what makes `modules/kitchen`'s dashboard endpoint (below) list orders across *every* canteen by design, not as an oversight.

**`modules/kitchen`** (Kitchen Workflow phase) is a **pure delegation facade over `OrdersService`** — it contains no independent business logic at all. `KitchenService`'s five methods each map 1:1 onto an existing `OrdersService` method (`searchOrders`, `getOrderById`, `updateStatus` called four times with a fixed target status per endpoint); every rule a kitchen_staff account is bound by — forward-only transitions, the atomic repository-level transition guard, immutability of completed/cancelled orders, no ability to touch pricing/items/snapshots/payment info, no cancel capability — already lives in `orders/` and is inherited for free simply by calling the same method, satisfying this phase's explicit "do not duplicate Order business logic" requirement literally. The module still has its own `service`/`controller`/`routes`/`validation` layer (not just extra routes bolted onto `orders.routes.ts`) so the project's `routes → controller → service → repository → model` layering stays uniform across every module, even one with no rules of its own.

Two small, deliberate extensions to `modules/orders` were made to support this, per the same "reuse the existing Order repository/service wherever possible" instruction that shaped `modules/kitchen` itself:
- `OrdersRepository.search()` gained an optional `pickupToken` filter (the kitchen dashboard's third filter, alongside status/orderNumber) — additive, so no existing caller (`findByStudent`, `findByCanteen`, the direct Orders API) is affected.
- `OrdersService.searchOrders()` is a new, unscoped (no canteenId/studentId) wrapper around that search, added because "list every order, unscoped" is Order domain logic — it belongs next to `listMyOrders`/`listCanteenOrders`, not duplicated inside `modules/kitchen`.

**One modification to already-completed code, not an addition** — required, not incidental: `OrdersService.updateStatus` used to log a single generic `order.status_updated` audit action for every forward transition. This phase's spec explicitly requires per-transition action names (`order.accepted`, `order.preparing`, `order.ready`, `order.completed`). Since Kitchen's four transition endpoints and the pre-existing `PATCH /orders/:id/status` endpoint both funnel through this one method, the only way to get the required names without every Kitchen-driven transition producing *two* audit rows for one business event (a redundant generic one plus a second, Kitchen-written specific one) was to change what `updateStatus` itself logs — a `statusUpdateAuditAction()` helper now maps the target status to the correct action name. This benefits **both** callers identically, not just Kitchen: a status change made via the direct API is now just as precisely logged as one made via Kitchen. `order.status_updated` was removed from `audit-log.types.ts`'s `AUDIT_ACTIONS` enum (a write-time Mongoose validator only — any historical `audit_logs` documents already carrying that value are untouched and remain readable). Regression coverage: `orders.service.test.ts`'s `updateStatus` describe block and `orders.integration.test.ts` both assert the specific action per transition, replacing the old generic-action assertions.

**`modules/notifications`** (Notifications phase) is in-app only — no Firebase push delivery yet (`FCM_*` env vars remain unused placeholders, same status as Razorpay's). It exposes exactly one integration surface to the rest of the codebase, `NotificationsService.notifyOrderEvent(...)`, which takes plain primitives (`userId`, `orderId`, `orderNumber`, `type`, ...) — never an `Order` document or DTO — so this module has **zero** dependency on `orders/` in either direction, even though `orders/` depends on it. `notifyOrderEvent` never throws (same "must not break the caller's flow" pattern as `AuditLogService.record()`): a notification failure must never fail the order lifecycle event that triggered it.

**A second modification to already-completed code, same "strictly required for integration" bar as the Kitchen phase's audit-naming change:** the spec requires a notification be created automatically on every order-lifecycle event (placed, accepted, preparing, ready, completed, cancelled), reusing `OrdersService` rather than duplicating its transition logic. The only integration point that sees *every* one of these events — regardless of whether the triggering request came through the direct Orders API or through `modules/kitchen`'s facade — is `OrdersService` itself, so `placeOrder`, `updateStatus`, and `cancelOrder` each gained one `notificationsService.notifyOrderEvent(...)` call (plus a new constructor parameter, defaulted like every other dependency). This was chosen over the alternative of adding the call to every controller that can trigger a transition (`OrdersController` *and* `KitchenController`, four separate endpoints in the latter) — hooking `OrdersService` once means `modules/kitchen`, completed in the immediately preceding phase, required **zero** changes to gain notifications; a controller-level hook would have needed the identical call duplicated in five places across two modules. A `statusNotificationType()` helper (mirroring `statusUpdateAuditAction()`'s exhaustive-switch shape exactly) maps each forward status to its `NotificationType`. Regression coverage: `orders.service.test.ts` gained a `notificationsService` mock (required — without it, the pre-existing unit tests would reach a real, disconnected `NotificationModel` the moment they hit the new call site) and per-transition assertions; `notifications.integration.test.ts` asserts the real end-to-end behavior (placing/advancing/cancelling an order via HTTP produces the right notification, scoped to the student, invisible to the acting kitchen_staff user).

**`modules/payments`** (Payments/Razorpay phase) depends on `OrdersService` (`getOrderById` for ownership + the order total; `updatePaymentStatus` to mark an order `paid`/`refunded`), `NotificationsService` (`notifyOrderEvent` with three new types), `AuditLogService` (four new `payment.*` actions) — all through their service, never a repository — plus one dependency no prior module has had: an outbound HTTP call to a third-party gateway. `RazorpayClient` (`modules/payments/razorpay.client.ts`) is this module's own external-integration boundary, using Node's built-in `fetch` rather than the `razorpay` npm package — the surface needed is one endpoint (create order), and a hand-rolled client keeps the HTTP call, auth-header construction, and error handling fully visible and independently mockable (see `payments.integration.test.ts`'s `jest.mock` of it, the same pattern `auth.integration.test.ts` uses for `LoggingEmailService`) without an SDK's own retry/queueing behavior this project doesn't need.

One entry point, two triggers, one shared code path: a payment can resolve to `SUCCESS`/`FAILED`/`REFUNDED` either synchronously (`POST /payments/verify`, the student's own Checkout callback) or asynchronously (`POST /payments/webhook`, Razorpay's server-to-server notification) — both funnel through one private `PaymentsService.transitionPaymentStatus()` method, so the "update order payment status → notify → audit" side-effect sequence is written exactly once. This is the same "reuse one method from multiple entry points" shape as Kitchen's four endpoints all calling `OrdersService.updateStatus`, applied *within* a single module instead of *between* two. `transitionPaymentStatus` is also where idempotency lives: a payment already at its target status is a silent no-op (no re-audit, no re-notify, no re-`updatePaymentStatus`), and an attempted transition outside `payments.constants.ts`'s `PAYMENT_FORWARD_TRANSITIONS` map is logged and treated as a safe no-op rather than thrown — required by the spec for both "duplicate verification must be idempotent" and "webhook retries must be idempotent," since a retry of either kind re-enters this exact method.

**"Each order can have only one successful payment"** is enforced twice, deliberately: `PaymentsService.createPaymentOrder` pre-checks `PaymentsRepository.existsSuccessForOrder` for a fast, specific `409 PAYMENT_ALREADY_COMPLETED`, but the actual guarantee is `payment.model.ts`'s partial unique index — `{ orderId: 1, status: 1 }`, unique where `status: 'SUCCESS'` — which is what stops two concurrent `/verify`-or-webhook calls from both writing a `SUCCESS` document for the same order. Same belt-and-suspenders shape as the uniqueness checks already in `canteens/`/`menu/` (a service-level pre-check plus a DB-level constraint as the real guarantee); `payments.repository.test.ts` has a regression test asserting the DB itself rejects a second `SUCCESS` (MongoDB error code `11000`), not just that the service-level check catches it.

**Webhook error handling is intentionally asymmetric with `/verify`'s.** Only an invalid or missing signature makes `handleWebhookEvent` throw (surfacing as a non-2xx to Razorpay); every other failure — an unrecognized event type, a payload that doesn't correlate to any known payment, an unexpected processing error — is caught, logged, and still resolves as handled. Razorpay retries aggressively on any non-2xx response, and none of those other failure modes would be fixed by a retry, so letting them propagate would just produce a retry storm for something that can't self-heal. `POST /payments/verify`, by contrast, *does* let its errors (404/403/422) propagate to the calling student — a synchronous, user-facing request should show a real failure, not swallow it.

**One necessary modification to `app.ts` (strictly for integration, not a behavior change):** `express.json()`'s `verify` callback now captures the exact raw request bytes into `req.rawBody` (typed via `modules/payments/raw-body.types.ts`'s `declare module` augmentation, the same pattern `auth.middleware.ts` uses for `req.user`). This exists solely because Razorpay's webhook `X-Razorpay-Signature` header is an HMAC over the *literal bytes Razorpay sent* — `JSON.stringify(req.body)` is not guaranteed to reproduce those bytes (key order, whitespace), so re-serializing and re-hashing `req.body` would silently break verification for real webhook traffic even though it might coincidentally pass a same-process test. This is additive to every other route (`req.rawBody` is simply unused outside `modules/payments`); the full pre-existing test suite passing unchanged (698 tests, 49 suites) is the regression proof required for touching a previously-completed file.

**Two small, additive extensions to already-completed modules**, both following the same "strictly required for integration" bar as the Kitchen/Notifications phases' precedents:
- `OrdersRepository.updatePaymentStatus` / `OrdersService.updatePaymentStatus` — a pure data mutation (unconditional `$set`, no `fromStatus` guard) with **no** audit/notification side effects of its own, unlike `updateStatus`/`cancelOrder`. `PaymentsService.transitionPaymentStatus` already audits and notifies around the payment event that triggers this call; doing so again inside `orders/` would duplicate both. The absence of a transition guard here is deliberate: correctness is owned entirely by `PAYMENT_FORWARD_TRANSITIONS` in `payments/`, the caller — `orders/` has no independent opinion about payment-status ordering.
- `NotificationsService`'s `NotifyOrderEventInput` gained two optional fields (`amount`, `failureReason`) and `buildNotificationContent`'s switch gained three cases (`payment_success`, `payment_failed`, `payment_refunded`) — no new method, since `notifyOrderEvent` already accepted a generic `type` parameter. `AUDIT_ACTIONS` gained four `payment.*` entries, following the same direct status→action mapping `statusUpdateAuditAction()` established for orders.

**`modules/analytics`** (Analytics phase) is **read-only and owns no MongoDB collection of its own** — a deliberate departure from every prior module's `routes → controller → service → repository → model` shape (§3.1's own template above lists all six files; this module has no `analytics.model.ts` and no `analytics.repository.ts`). Analytics is fundamentally a cross-cutting reporting concern over data five *other* modules already own (`orders`, `users`, `canteens`, `menu`) — the phase spec's own strongest, most repeated instruction is "reuse existing repositories and services... do NOT duplicate business logic," and creating an `AnalyticsRepository` would have meant one of two worse options: either duplicating aggregation queries that rightfully belong next to their data (violating "do not duplicate"), or reaching into `OrderModel`/`UserModel`/`CanteenModel`/`MenuItemModel` directly from a module that owns none of them (violating this section's own module-boundary rule, which no prior phase has ever broken). Instead, `AnalyticsService` (`analytics.service.ts`) is pure orchestration — the same "no data of its own, just calls into other modules' services" shape `modules/kitchen` already established for a workflow facade, applied here to a reporting one. It depends on `OrdersService`, `UsersService`, `CanteensService`, `MenuItemsService` — all through their public service, never a repository.

Every aggregation those services expose was added *to* them for this phase (an additive extension, not a rewrite — see below), and every one uses a real MongoDB aggregation pipeline (`$group`, `$dateTrunc`, `$lookup`, `$cond`), not an in-memory reduce over a fetched array, per the phase's "avoid unnecessary queries, optimize performance" instruction. Several endpoints deliberately return *more* than one raw query's worth of data from a single aggregation call rather than issuing near-duplicate queries: `OrdersRepository.getRevenueByCanteen` answers both "Revenue by Canteen" and "Orders by Canteen" in one group-by (`AnalyticsController`'s canteen endpoint exposes this as one `byCanteen` array carrying both fields, plus a `topPerforming` slice of the same array — not three separate, largely-identical arrays); `OrderItemsRepository.getItemSalesAggregate` is fetched once per request and sorted/sliced three different ways in `AnalyticsService` to answer "Top Selling," "Least Selling," and "Revenue per Item" at once; `OrdersRepository.getCustomerOrderStats` similarly answers "Active Users," "Repeat Customers," and "Top Customers" from one per-student group-by.

**Additive extensions to five already-completed modules**, each following the same "strictly required for integration" bar as every prior phase's precedent (Kitchen's `OrdersRepository.search` pickupToken filter, Payments' `updatePaymentStatus`): `OrdersRepository`/`OrdersService` gained ten read methods (status counts — now accepting an *optional* date filter, see below — revenue summary/time-series, orders-by-day/month, peak-ordering-hours, average-preparation-time, revenue-by-canteen, customer-order-stats); `OrderItemsRepository` gained two (item-sales and category-revenue aggregates, both excluding a `cancelled` order's items via a same-module `$lookup` join to `OrderModel` — order and order-item are two collections of one aggregate root, so this isn't a cross-module boundary crossing, the same reasoning that already permits `OrdersService` to call `orderItemsRepository` directly); `UsersRepository`/`UsersService` gained three (role counts, new-user counts, batch `findByIds`); `CanteensRepository`/`CanteensService` and `MenuItemsRepository`/`MenuItemsService` each gained a `count()` (`CanteensRepository` also gained `findByIds`, for resolving canteen names without an N+1 query per row). None of these touch any existing method's behavior — every one is a new, additive method, and the full pre-existing test suite passing unchanged is the regression proof.

**One small unification made *during* this phase, not left as two overlapping methods:** `OrdersRepository.getStatusCounts` was initially written twice — once unfiltered (for the Dashboard's all-time breakdown) and once as a separate `getCompletionCounts(filter)` returning just `{total, completed, cancelled}` (for Order Analytics' completion rate). Since a range-scoped call to the *first* method already contains everything the second one computed, `getStatusCounts` was given an optional `filter: DateRangeFilter = {}` parameter and `getCompletionCounts` was deleted before this phase shipped — one query answers both call sites, and `AnalyticsService.getOrderAnalytics` derives `completionRate` (`completed / total`, as a percentage, `0` for an empty range rather than `NaN`) from the same breakdown it already needed for `byStatus`.

**"Active Users" is order-domain, not `IUser.isActive`.** The spec's User Analytics section doesn't define what "active" means, and this codebase already has a field named `isActive` on `IUser` — but that field means "account not disabled" (it gates login in `auth.middleware.ts`), a completely different concept from "did this customer actually order anything." `AnalyticsService` defines "active" as "placed >=1 order in the resolved window," computed from `OrdersRepository.getCustomerOrderStats`, not from any `users/` field — documented here since the ambiguity is real and the choice isn't self-evident from the code alone. Similarly, "Total Staff" on the Dashboard is defined as every role that isn't `student` (`kitchen_staff + admin + super_admin`), a grouping the spec doesn't define either.

**A sixth "strictly required for integration" extension — the Admin Panel's Operations Center phase (`apps/admin`'s `/orders` control room):** `GET /kitchen/orders` was, until this phase, the only *unscoped* (all-canteens) order list, but it only filtered by `status`/`orderNumber`/`pickupToken`/`sortOrder` — the *scoped* `GET /canteens/:canteenId/orders` already had `dateFrom`/`dateTo`/`studentId`, but "unscoped across every canteen" and "has a full filter set" had never been true of the same endpoint at once. Building the Operations Center's filters as client-side post-filters over one already-paginated page was considered and rejected: an admin filtering by payment status needs every matching order, not just the ones that happened to already be on the loaded page — a filter that silently only searches what's in memory is a worse bug than no filter at all. `listKitchenOrdersQuerySchema` gained `paymentStatus`/`studentId`/`canteenId`/`dateFrom`/`dateTo`/`minAmount`/`maxAmount` (all optional; a request using none of them is byte-identical to before), `OrdersRepository.search()` gained `paymentStatus`/`minAmount`/`maxAmount` filter support (`studentId`/`canteenId`/`dateFrom`/`dateTo` already existed, added for the scoped Orders API), and `OrdersService.searchOrders()`/`KitchenService.listOrders()` were widened to pass all seven through untouched — the exact same "additive extension, mirroring the precedent this endpoint already set with `pickupToken`" shape as every prior phase's integration point.

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

> **Superseded, not reconciled — same relationship as `DATABASE_DESIGN.md`'s §2.17/§2.19/§2.20 to their stale sketches.** §4.1-4.3 below describe the *real, implemented* `apps/admin` (Admin Panel phase). The original text sketched a "Restaurant Partners vs. Platform Admins" split modeled on the abandoned multi-restaurant marketplace vision — it doesn't correspond to any role this backend actually has. QBite's real role model (`student | kitchen_staff | admin | super_admin`, single-tenant campus canteens — §3.1's `modules/orders` note) has no "restaurant partner" concept at all; every admin/super_admin account manages every canteen. The Socket.IO real-time layer §4.2 assumed also was never built (`src/sockets/`/`src/jobs/` remain empty — confirmed by inspecting the repository, not assumed) — everything below reflects REST + polling only.

### 4.1 One Role-Gated App, Not Two Surfaces

There is exactly one route-group split, and it's `auth` vs. `everything else`, not a role split:

```
app/
  (auth)/          → login, forgot-password, reset-password — unauthenticated
  (dashboard)/      → every admin-panel page, behind AuthProvider's client-side gate
```

`/auth/login` itself doesn't restrict by role — any valid credentials succeed, since the same endpoint will eventually serve a student-facing app too. This admin panel draws its own line, client-side: `ADMIN_PANEL_ROLES = [kitchen_staff, admin, super_admin]` (`types/auth.ts`) is checked right after login and right after the silent-refresh-on-mount `GET /auth/me` call (`providers/auth-provider.tsx`'s `assertAdminAccessible`) — a `student` account authenticates fine but is immediately rejected with a clear message, since every screen here would otherwise just render empty/403 for one. Within the admin-accessible roles, no page-level role gate exists yet in Phase 1 (the sidebar shows every item to every admin-panel role); the backend's own `requireRole` middleware is still the actual authorization boundary for every mutation, per §9.7 — the frontend gate is a UX nicety, never the security boundary, exactly as this section's original defense-in-depth framing intended.

### 4.2 Rendering Strategy (as built, Phase 1)

- **Client Components throughout**, not Server-Components-by-default as originally planned. This is a direct consequence of §4.3 below: the refresh-token cookie is scoped to the *backend's* `/api/v1/auth` path, which means a Next.js Server Component (running on the Next.js server, a different origin from the backend) has no automatic way to attach it to a fetch — there is no server-side session to render from without deliberately forwarding cookies through a proxy layer, which Phase 1 doesn't build. Every data-fetching page is `'use client'`, backed by TanStack Query (`features/*/hooks/`) calling `lib/api/client.ts` directly from the browser, where the cookie *is* naturally present. Revisiting Server Components for the data-heavy screens (Orders, Reports) is a reasonable optimization for a later phase, via an explicit cookie-forwarding proxy — not done here because Phase 1's brief was the shell, not that optimization.
- No Socket.IO — the backend has none (see the callout above). "Live" data in Phase 1 (the dashboard's stat cards) is a single fetch on mount, not a subscription; a future phase that wants a genuinely live activity feed either adds real-time infrastructure to the backend first, or polls via TanStack Query's `refetchInterval` as a lighter-weight interim step.
- TanStack Query *is* the global client-side data layer this section originally said v1 wouldn't need — correct at the time (no frontend existed yet to need one), superseded now that one does.

### 4.3 Auth Handling (Web-Specific) — corrected: gating is client-side, not middleware

- **The refresh token**, specifically — not the access token — is what's stored in an **httpOnly, secure, SameSite cookie** (not `localStorage`), to reduce XSS token-theft exposure. The access token is short-lived (15 min) and kept in memory (`lib/api/token-store.ts` — a module-level variable, not React state and not persisted), attached to each request via `Authorization: Bearer`, the same as the mobile client. Confirmed against the real implementation: `apps/backend/src/modules/auth/auth.controller.ts` sets `qbite_refresh_token` via `res.cookie(...)` on login/refresh, scoped to `path: '/api/v1/auth'`.
- **That `path` scoping has a consequence the original text didn't anticipate: the cookie is invisible to `apps/admin`'s own Next.js middleware.** A browser only attaches a cookie to requests whose path matches the cookie's `Path` attribute — so the *only* requests that ever carry `qbite_refresh_token` are ones going to `/api/v1/auth/*` on the *backend*. A request to `apps/admin`'s own pages (e.g. `GET /dashboard`) never carries it, regardless of same-origin/cross-origin, so `middleware.ts` reading `request.cookies` — the plan this section originally described as "middleware-level session check on every protected route before render" — cannot work as stated; there is nothing there to read. Phase 1 therefore gates purely client-side: `(dashboard)/layout.tsx` renders a loading skeleton while `AuthProvider`'s mount effect calls `POST /auth/refresh` (`credentials: 'include'`, hitting the backend directly, where the cookie *is* present) followed by `GET /auth/me`, then either renders `children` or redirects to `/login`. This is the standard pattern used by SPA-style dashboards with this exact cookie shape (Linear, Vercel, and Notion's own dashboards all gate this way for the same structural reason) — not a shortcut, the correct answer given the constraint.
- Mobile has no equivalent cookie story with Dio/`flutter_secure_storage`, so the refresh token is *also* returned in the JSON response body — the backend delivers it both ways from the same endpoint, and each client uses whichever mechanism fits it. See [§6](#6-authentication-flow).
- Backend CORS (`apps/backend/src/app.ts`) is already configured for this: `cors({ origin: env.corsOrigin, credentials: true })`, with `CORS_ORIGIN` defaulting to `http://localhost:3000` — Next's own dev-server port — so browser-to-backend credentialed requests work out of the box in development with no proxy.

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
