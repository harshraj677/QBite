# QBite — API Specification

**Scope:** This document defines the *standards and conventions* the QBite API must follow. It is not an endpoint-by-endpoint reference (that will be generated from code/OpenAPI once implementation begins) — it is the contract every future endpoint must conform to, so the API is predictable and consistent from the first route written.
**Related documents:** [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`DATABASE_DESIGN.md`](./DATABASE_DESIGN.md)

---

## 1. REST API Standards

- **Resource-oriented:** URLs identify resources (nouns), HTTP methods express the action (verbs). No `/getOrders` or `/createOrder` — use `GET /orders` and `POST /orders`.
- **Statelessness:** every request carries all context needed to process it (auth token, params). The server holds no per-client session state between requests — consistent with the [architecture's statelessness principle](./ARCHITECTURE.md#93-statelessness).
- **HTTPS only**, in every environment including local development against staging — no plaintext HTTP for any endpoint that touches auth or payment data.
- **JSON only** for request and response bodies (`Content-Type: application/json`), except file uploads (`multipart/form-data`, used only for document/image upload endpoints).
- **One resource, one URL family:** avoid multiple URL shapes for the same resource. If both a customer and a restaurant partner can view orders, that's `GET /orders` with role-based scoping applied server-side — not two separate endpoints.
- **Idempotent methods stay idempotent:** `GET`, `PUT`, `DELETE` never cause side effects beyond their stated purpose. Anything with real-world side effects that must survive retries (order creation, payment confirmation) implements explicit idempotency (see §5.2 of ARCHITECTURE.md's data flow, and idempotency keys where applicable).

---

## 2. URL Naming

- **Plural nouns** for collections: `/restaurants`, `/orders`, `/menu-items` — not `/restaurant`, `/order`.
- **kebab-case** in URL paths (`/menu-items`, `/delivery-partners`), **camelCase** in JSON bodies/query params (`restaurantId`, `sortBy`) — each format matches the convention of the medium it lives in.
- **Nesting reflects real ownership, capped at one level deep:** `/restaurants/:id/menu` is fine; `/restaurants/:id/menu/:itemId/reviews/:reviewId/...` is not — deeply nested URLs are a sign the resource should be addressed at its own top-level path with a filter instead (e.g. `/reviews?restaurantId=`).
- **Actions that aren't pure CRUD use a verb sub-resource, sparingly:** `PATCH /orders/:id/cancel`, `PATCH /orders/:id/accept` — acceptable because "cancel" and "accept" are state transitions, not just field updates, and modeling them as a generic `PATCH /orders/:id { status: 'cancelled' }` would let a client set *any* status, bypassing the state-machine rules the service layer enforces.
- **IDs are MongoDB ObjectIds passed as path params**, never as query params, for single-resource access: `GET /orders/:id`, not `GET /orders?id=`.

---

## 3. Request Format

- **Headers:**
  - `Authorization: Bearer <access_token>` on every protected route.
  - `Content-Type: application/json` on every request with a body.
  - `X-Request-Id` (optional, client-generated) echoed back in the response for support/debugging correlation.
- **Body:** camelCase JSON keys, matching the field naming convention in [DATABASE_DESIGN.md §6](./DATABASE_DESIGN.md#6-naming-conventions).
- **Validation:** every request body/query/param is schema-validated (Zod/Joi) before it reaches business logic — validation failures return the standard error envelope (§5) with `400`, never a raw stack trace or a silent `undefined` propagating downstream.
- **Client-computed values are advisory only, never authoritative** — most importantly pricing, totals, and discounts, which are always recalculated server-side regardless of what the client sends (see [ARCHITECTURE.md §9.1](./ARCHITECTURE.md#91-server-is-the-source-of-truth)).

---

## 4. Response Format

All successful responses share one envelope shape:

**Single resource:**
```
{
  "success": true,
  "data": { ... }
}
```

**Collection (paginated):**
```
{
  "success": true,
  "data": [ { ... }, { ... } ],
  "meta": {
    "total": 132,
    "page": 2,
    "limit": 20,
    "hasMore": true
  }
}
```

- `data` is always present on success, even if it's `null` (e.g. a `DELETE` may return `{ success: true, data: null }`).
- No bare arrays or bare objects at the top level, ever — the envelope is non-negotiable so client code can handle every response uniformly.

---

## 5. Error Response Standard

**Envelope:**
```
{
  "success": false,
  "error": {
    "code": "ORDER_ALREADY_ACCEPTED",
    "message": "This order has already been accepted by the restaurant.",
    "details": null
  }
}
```

- `code` is a **stable, machine-readable, SCREAMING_SNAKE_CASE** identifier the client can branch on — client code must never pattern-match on `message` text, which is for humans and may be reworded.
- `message` is a human-readable description, safe to show in a UI or log.
- `details` is optional structured context (e.g. field-level validation errors) — `null` when not applicable, never an inconsistent shape per error type.

### 5.1 HTTP Status Code Mapping

| Status | Meaning | Example |
|---|---|---|
| `200` | Success (read/update) | |
| `201` | Resource created | `POST /orders` |
| `204` | Success, no content | rarely used — prefer `200` with `data: null` for consistency with the envelope |
| `400` | Validation failure / malformed request | missing required field |
| `401` | Missing/invalid/expired auth token | |
| `403` | Authenticated but not authorized for this action | restaurant partner accessing another restaurant's order |
| `404` | Resource not found | |
| `409` | Conflict with current state | accepting an already-accepted order, duplicate coupon redemption |
| `422` | Semantically invalid though well-formed | coupon exists but is expired |
| `429` | Rate limit exceeded | OTP request spam |
| `500` | Unhandled server error | logged with full context server-side, generic message returned to client |

### 5.2 Error Code Taxonomy

Error codes are namespaced by domain so they're greppable and self-documenting: `AUTH_*`, `ORDER_*`, `PAYMENT_*`, `RESTAURANT_*`, `VALIDATION_*`. Example: `PAYMENT_SIGNATURE_INVALID`, `ORDER_INVALID_STATE_TRANSITION`, `AUTH_TOKEN_EXPIRED`. The full enumerated list lives alongside the backend's error-handling module once implementation begins, not duplicated here (single source of truth — code, not docs).

---

## 6. Authentication Strategy

- **JWT bearer tokens** for access; an **opaque, DB-tracked token** (not a JWT) for refresh — issued per the flow defined in [ARCHITECTURE.md §6](./ARCHITECTURE.md#6-authentication-flow).
- **Access token:** short-lived (15 min) JWT, sent on every request via `Authorization: Bearer` header.
- **Refresh token:** long-lived (30 days), rotated on every use with reuse-detection (a reused, already-rotated token revokes its entire token family), stored hashed (SHA-256) server-side. Revocable individually (`/auth/logout`), automatically as a family (reuse detection), or entirely for a user (`/auth/reset-password` revokes every session).
- **Role scopes enforced server-side per route**, declared explicitly at the route level (e.g. `requireRole('admin', 'super_admin')`) — never inferred implicitly from which frontend happens to be calling.
- **One exception to bearer-auth: the Razorpay webhook endpoint** (`POST /payments/webhook`). It carries no user JWT (Razorpay is calling the server directly) and is instead authenticated by verifying the request's HMAC-SHA256 signature against the shared webhook secret. This is a deliberate, explicitly-documented exception to the "everything requires a bearer token" rule — not an oversight, and it must remain the *only* such exception without an explicit architecture review.

---

## 7. API Versioning

- **URI-based versioning:** all routes live under `/api/v1/...`.
- A breaking change (removed field, changed response shape, changed semantics of an existing field) requires a new version prefix (`/api/v2/...`); additive, backward-compatible changes (new optional field, new endpoint) do **not** require a version bump.
- Old versions are supported for a defined deprecation window (minimum one full mobile-app release cycle, since app-store rollout means old clients persist in the wild longer than a web deploy) before removal — deprecation is announced via a response header (`X-API-Deprecated: true`) before the version is actually removed.

---

## 8. Pagination

- **Offset-based pagination** for v1 (`?page=1&limit=20`), matching the response `meta` shape in §4.
- `limit` is capped server-side (e.g. max 50) regardless of what the client requests — prevents an accidental or malicious `limit=100000` from taking down a query.
- Default `page=1`, `limit=20` when unspecified.
- **Deferred, noted for future scale:** cursor-based pagination for very high-volume, frequently-changing feeds (e.g. a live restaurant order queue at high scale) is a known future upgrade path if offset pagination's performance degrades on deep pages — not implemented in v1 because it adds client complexity (opaque cursor handling) that isn't justified at launch volume.

---

## 9. Filtering

- Filters are passed as **individual query params matching the field name**, not a generic `filter` blob: `GET /restaurants?cuisineTags=italian&isOpen=true`.
- Multi-value filters use comma-separation or repeated params, consistently per field, documented per-endpoint when implemented: `?cuisineTags=italian,chinese`.
- Range filters use explicit `min`/`max` suffixes: `?priceMin=100&priceMax=500`.
- **All filters are validated against an explicit allow-list of filterable fields per endpoint** — arbitrary field filtering is not exposed generically, both for query performance predictability (every filterable field must be indexed, per [DATABASE_DESIGN.md §4](./DATABASE_DESIGN.md#4-indexes)) and to avoid leaking internal field names as an implicit API surface.

---

## 10. Sorting

- `?sortBy=<field>&sortOrder=asc|desc`, single-field sort for v1 (multi-field sort is a documented future extension, not built until a real use case needs it).
- Default sort is specified explicitly per endpoint (e.g. restaurant listing defaults to distance-ascending, order history defaults to `createdAt` descending) — never left as "whatever MongoDB returns," which is not a stable guarantee.
- Only indexed fields are sortable — same reasoning as filtering (§9): an unindexed sort on a large collection is a production incident waiting to happen, so sortable fields are an explicit allow-list, not open-ended.
