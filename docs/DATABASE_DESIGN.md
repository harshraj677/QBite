# QBite — Database Design

**Database:** MongoDB (Atlas), accessed via Mongoose (schema validation enforced at the application layer — see [ARCHITECTURE.md §9](./ARCHITECTURE.md#9-design-principles)).
**Related documents:** [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`API_SPECIFICATION.md`](./API_SPECIFICATION.md)

---

## 1. Entity Relationship Design

MongoDB is a document database — this is not a normalized relational schema. Relationships below are modeled by **reference** (for large, independently-changing, or shared entities) or **embedding** (for data that is always read together and doesn't need independent querying). The rationale for each choice is in §3.

```
 users ──1───< addresses (embedded)
   │
   ├──1───< restaurants (via ownerUserId)          [one owner can own multiple restaurants]
   │
   ├──1───< orders (via customerId)
   │
   └──1───1 delivery_partners (via userId)          [role-extension document]

 restaurants ──1───< menu_items (via restaurantId)
   │
   └──1───< orders (via restaurantId)

 orders ──1───1 payments (via orderId)
   │
   ├──1───1 reviews (via orderId)
   │
   └──*───1 delivery_partners (via deliveryPartnerId)

 coupons  (standalone, referenced by code at order-creation time, not FK-linked)

 notifications ──*───1 users (via userId)
```

### Cardinality Summary

| Relationship | Cardinality | Modeling Choice |
|---|---|---|
| User → Addresses | 1 : many | Embedded (small, always read with user) |
| User (owner) → Restaurants | 1 : many | Referenced |
| Restaurant → Menu Items | 1 : many | Referenced (menu grows large, updated independently, queried on its own) |
| Order → Order Items | 1 : many | **Embedded snapshot** (see §3.3 — deliberate exception) |
| Order → Payment | 1 : 1 | Referenced (payment has its own lifecycle/audit needs) |
| Order → Review | 1 : 1 | Referenced |
| Order → Delivery Partner | many : 1 | Referenced |
| User → Delivery Partner profile | 1 : 1 | Referenced (role-extension pattern, §3.4) |

---

## 2. Collections

### 2.1 `users`

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `phone` | String | Unique, indexed. Primary login identifier. |
| `email` | String? | Optional, unique if present. |
| `passwordHash` | String? | Only set if email/password auth used; OTP-only users may not have one. |
| `name` | String | |
| `role` | Enum | `customer` \| `restaurant_owner` \| `delivery_partner` \| `admin` |
| `addresses` | Array\<Embedded\> | `{ label, geoPoint, formattedAddress, isDefault }` |
| `fcmTokens` | Array\<String\> | Multiple devices per user supported. |
| `isActive` | Boolean | Soft-disable flag; disabled users fail auth, not deleted. |
| `createdAt` / `updatedAt` | Date | Standard timestamps (Mongoose `timestamps: true`). |

### 2.2 `restaurants`

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `ownerUserId` | ObjectId (ref `users`) | Indexed. |
| `name` | String | |
| `description` | String | |
| `cuisineTags` | Array\<String\> | Indexed for filter queries. |
| `location` | GeoJSON Point | **2dsphere indexed** — required for radius search. |
| `address` | String | Human-readable, denormalized from `location`. |
| `operatingHours` | Embedded | `{ day, openTime, closeTime }[]` |
| `isOpen` | Boolean | Manual override toggle, independent of `operatingHours` schedule. |
| `avgRating` / `ratingCount` | Number | Denormalized aggregate, updated on new review (see §3.5). |
| `commissionRate` | Number | Platform-configured per restaurant. |
| `fssaiLicenseUrl` | String | Compliance document, CDN URL. |
| `status` | Enum | `pending` \| `approved` \| `rejected` \| `suspended` |
| `bannerImageUrl` | String | CDN URL. |

### 2.3 `menu_items`

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `restaurantId` | ObjectId (ref `restaurants`) | Indexed. |
| `name` / `description` | String | |
| `price` | Number | Base price, in smallest currency unit (paise) — see §6 naming note. |
| `category` | String | Used for menu grouping in UI. |
| `imageUrl` | String | CDN URL. |
| `variants` | Array\<Embedded\> | `{ name, priceDelta }` |
| `addOns` | Array\<Embedded\> | `{ name, price }` |
| `isVeg` | Boolean | |
| `isAvailable` | Boolean | Restaurant-toggleable ("out of stock"). |

### 2.4 `orders` (central aggregate)

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `orderNumber` | String | Human-readable, unique, indexed (e.g. `QB-2026-000123`). |
| `customerId` | ObjectId (ref `users`) | Indexed. |
| `restaurantId` | ObjectId (ref `restaurants`) | Indexed. |
| `deliveryPartnerId` | ObjectId? (ref `delivery_partners`) | Nullable until assigned. |
| `items` | Array\<Embedded snapshot\> | See §3.3 — **not** a live reference to `menu_items`. |
| `addressSnapshot` | Embedded | Copied at order time; independent of later address edits/deletes. |
| `pricing` | Embedded | `{ subtotal, deliveryFee, platformFee, tax, discount, tip, total }` — all server-computed. |
| `couponCode` | String? | |
| `paymentStatus` | Enum | `pending` \| `paid` \| `failed` \| `refunded` |
| `paymentId` | ObjectId (ref `payments`) | |
| `orderStatus` | Enum | State machine value — see §2.4.1. |
| `statusHistory` | Array\<Embedded\> | `{ status, timestamp, actorId }` — append-only audit trail. |
| `createdAt` / `deliveredAt` | Date | |

**2.4.1 `orderStatus` state machine:**
`PAYMENT_PENDING → PLACED → ACCEPTED → PREPARING → READY_FOR_PICKUP → OUT_FOR_DELIVERY → DELIVERED`, with terminal side-branches `CANCELLED` and `REJECTED`. Transitions are enforced in the service layer, not left to the client to imply.

### 2.5 `payments`

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `orderId` | ObjectId (ref `orders`) | Indexed. |
| `razorpayOrderId` | String | **Unique indexed.** |
| `razorpayPaymentId` | String | |
| `razorpaySignature` | String | Stored for audit; verification happens at write time, not read time. |
| `amount` | Number | Paise. Must equal `orders.pricing.total` — cross-checked server-side. |
| `status` | Enum | `created` \| `verified` \| `failed` |
| `method` | String | UPI/card/netbanking/wallet, from Razorpay payload. |
| `webhookVerifiedAt` | Date? | Null until webhook confirms — this is the actual "payment complete" marker, not order creation time. |
| `refunds` | Array\<Embedded\> | `{ amount, reason, status, refundedAt }` |

### 2.6 `reviews`

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `orderId` | ObjectId (ref `orders`) | Unique — one review per order. |
| `customerId` | ObjectId (ref `users`) | |
| `restaurantId` | ObjectId (ref `restaurants`) | Indexed (for restaurant review listing). |
| `restaurantRating` / `deliveryRating` | Number (1-5) | Captured separately per persona need (SRS §4). |
| `comment` | String? | |
| `restaurantReply` | String? | Set via admin panel. |

### 2.7 `coupons`

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `code` | String | **Unique indexed**, uppercase-normalized. |
| `discountType` | Enum | `flat` \| `percent` |
| `value` | Number | |
| `minOrderValue` / `maxDiscount` | Number | |
| `validFrom` / `validTo` | Date | |
| `usageLimitPerUser` | Number | Enforced against a per-user redemption count at apply time. |
| `applicableRestaurantIds` | Array\<ObjectId\>? | Null = platform-wide. |
| `isActive` | Boolean | |

### 2.8 `notifications`

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `userId` | ObjectId (ref `users`) | Indexed. |
| `title` / `body` | String | |
| `type` | Enum | e.g. `order_update`, `promo`, `payment` |
| `isRead` | Boolean | |
| `relatedOrderId` | ObjectId? | |
| `createdAt` | Date | TTL-indexed — see §4. |

### 2.9 `delivery_partners`

Role-extension document, kept separate from `users` rather than adding delivery-specific fields to every user row (see §3.4).

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `userId` | ObjectId (ref `users`) | Unique indexed. |
| `vehicleType` | Enum | |
| `idProofUrl` | String | CDN URL. |
| `status` | Enum | `pending` \| `approved` \| `suspended` |
| `isOnline` | Boolean | |
| `currentLocation` | GeoJSON Point | **2dsphere indexed** — nearest-partner queries. |
| `rating` | Number | Denormalized aggregate. |

---

## 3. Relationships — Embedding vs. Referencing Rationale

### 3.1 General Rule

> Embed what is always read together and rarely grows unbounded. Reference what is large, independently updated, or shared across many parent documents.

### 3.2 Addresses — Embedded in `users`

Small, bounded array (a user has a handful of addresses, not thousands), always fetched alongside the user profile, never queried independently across users. Embedding avoids an unnecessary join-equivalent lookup on every checkout screen load.

### 3.3 Order Items — Embedded **Snapshot**, Not a Live Reference (deliberate exception)

This is the single most important modeling decision in the schema. `orders.items[]` copies the item's name, price, variant, and add-ons **at the moment of order creation**, rather than referencing `menu_items._id` and joining at read time. Reasoning:

- If a restaurant changes a menu price tomorrow, every past order must still show the price the customer actually paid. A live reference would silently rewrite order history.
- Order history must remain accurate and legally/financially auditable independent of catalog churn (menu items get renamed, repriced, or deleted constantly in a real restaurant business).

This intentionally introduces some data duplication — an accepted tradeoff, not an oversight.

### 3.4 Delivery Partner as a Separate Collection, Not Fields on `users`

Only a small fraction of users are delivery partners, and their fields (`vehicleType`, `currentLocation`, live geospatial index) are irrelevant to and would bloat every customer document. Splitting keeps the hot-path `users` collection lean and lets the geospatial index on `currentLocation` exist only where it's actually needed.

### 3.5 Denormalized Aggregates (`avgRating`, `ratingCount`)

`restaurants.avgRating` is a denormalized, eventually-consistent aggregate updated on each new review write (via service-layer logic or a MongoDB transaction spanning `reviews` insert + `restaurants` update), rather than computed live by aggregating the full `reviews` collection on every restaurant-list request. This trades a small amount of write-time complexity for a very large read-time performance win on the highest-traffic screen in the app (restaurant listing).

### 3.6 Referenced, Not Embedded: `payments`, `reviews`

Both have their own independent lifecycle (a payment can be refunded days later; a review can be edited/replied-to independently of the order) and independent query patterns (admin needs to query payments across all orders for reconciliation) — embedding would force loading the entire order document for operations that only touch payment or review data.

---

## 4. Indexes

| Collection | Index | Type | Purpose |
|---|---|---|---|
| `users` | `phone` | Unique | Login lookup, prevents duplicate accounts. |
| `users` | `email` | Unique, sparse | Optional secondary login. |
| `restaurants` | `location` | `2dsphere` | Radius-based discovery query — the single most performance-critical index in the system. |
| `restaurants` | `{ status: 1, isOpen: 1 }` | Compound | Discovery query filters on both. |
| `restaurants` | `cuisineTags` | Multikey | Cuisine filter. |
| `menu_items` | `{ restaurantId: 1, isAvailable: 1 }` | Compound | Menu screen's primary query. |
| `orders` | `{ customerId: 1, createdAt: -1 }` | Compound | Order-history screen, newest-first. |
| `orders` | `{ restaurantId: 1, orderStatus: 1 }` | Compound | Restaurant live-order queue. |
| `orders` | `{ deliveryPartnerId: 1, orderStatus: 1 }` | Compound | Delivery-partner active-order lookup. |
| `orders` | `orderNumber` | Unique | Human-readable lookup, support/dispute reference. |
| `payments` | `razorpayOrderId` | Unique | Webhook idempotency check — prevents double-processing the same payment event. |
| `coupons` | `code` | Unique | Apply-coupon lookup. |
| `notifications` | `userId` | Standard | Notification center listing. |
| `notifications` | `createdAt` | **TTL** (e.g. 90 days) | Automatic cleanup — notifications are not kept indefinitely. |
| `delivery_partners` | `currentLocation` | `2dsphere` | Nearest-available-partner assignment query. |
| `delivery_partners` | `{ isOnline: 1, status: 1 }` | Compound | Filters candidate pool before geospatial query. |

**Index review discipline:** every new query added to the codebase must be checked against `explain("executionStats")` before merge if it runs against `orders`, `restaurants`, or `menu_items` — these are the collections with production-scale write volume. This is enforced as part of the [code review checklist](./CONTRIBUTING.md).

---

## 5. Future Scalability

The schema is intentionally designed so the **modular monolith → extracted service** path (see [ARCHITECTURE.md §9.2](./ARCHITECTURE.md#92-modular-monolith-over-microservices)) doesn't require a data-model rewrite later:

- **Collection boundaries already match module boundaries** (`orders` module owns `orders`+`payments`, `catalog` module owns `restaurants`+`menu_items`, etc.) — if a module is ever extracted into its own service, its collections can move with it largely unchanged.
- **Read scaling:** MongoDB Atlas read replicas can absorb read-heavy traffic (restaurant discovery, menu browsing) without schema changes — these are also the queries Redis caching targets first (see [ARCHITECTURE.md §3.3](./ARCHITECTURE.md)).
- **Write scaling / sharding:** if order volume eventually requires sharding, `orders` is the natural sharding candidate with `restaurantId` or a time-bucketed key as shard key (deferred decision — premature sharding adds operational complexity with no current justification).
- **Archival strategy:** old, terminal-state orders (`DELIVERED`/`CANCELLED` older than N months) are a candidate for a cold-storage/archive collection once `orders` grows large enough to affect hot-path query performance — not implemented in v1, flagged here so it isn't a surprise later.
- **Geospatial scaling:** `delivery_partners.currentLocation` updates are high-frequency by nature (live GPS pings). If update volume becomes a bottleneck, this is the first candidate to move location state into Redis (ephemeral, high-write, TTL-friendly) with MongoDB retaining only the partner's profile — a change isolated to the `delivery` module's repository layer, not a schema-wide change.
- **Multi-city expansion** (SRS roadmap): `restaurants.location` combined with a future `cityId`/region field supports city-scoped queries without restructuring existing collections — a field addition, not a migration.

---

## 6. Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Collection names | `snake_case`, plural | `menu_items`, `delivery_partners` |
| Field names | `camelCase` | `orderStatus`, `deliveredAt` |
| Reference fields | `<entity>Id` suffix | `restaurantId`, `deliveryPartnerId` |
| Boolean fields | `is`/`has` prefix | `isAvailable`, `isOpen`, `isActive` |
| Timestamps | `createdAt` / `updatedAt` (Mongoose-managed) | never a custom `date_created` |
| Enums | lowercase string values, defined as a shared constant, not inlined magic strings | `status: 'pending' | 'approved' | 'rejected'` |
| Monetary values | stored as integers in the smallest currency unit (paise), never floats | `price: 24900` (₹249.00) — avoids floating-point rounding errors in financial data |
| Embedded sub-documents | singular noun matching the concept, no `Obj`/`Data` suffix noise | `addressSnapshot`, not `addressSnapshotObj` |
| GeoJSON fields | always `{ type: 'Point', coordinates: [lng, lat] }` | matches MongoDB's required GeoJSON shape (longitude first — a common source of bugs if reversed) |
