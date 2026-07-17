# QuickBite — Software Requirements Specification & Product Requirement Document

**Document Owner:** Product & Engineering
**Version:** 1.0 (Pre-Development Planning)
**Date:** 2026-07-17
**Status:** Draft for stakeholder review — no code has been written against this document

---

## Scoping Assumption (read this first)

The requested tech stack (Razorpay, Socket.IO, FCM, Node/Express/MongoDB backend, Next.js admin panel) is characteristic of a **multi-restaurant food ordering & delivery marketplace** (Swiggy/Zomato-style), not a single-canteen ordering kiosk. This document is written on that assumption:

- **QuickBite Customer App** (Flutter) — the only mobile app in scope for v1.
- **QuickBite Backend** (Node.js/Express/MongoDB) — single source of truth for all clients.
- **QuickBite Admin Panel** (Next.js) — used by two internal actor types: **Platform Admins** (you/your team) and **Restaurant Partners** (who manage their own menu/orders through the same web app, gated by role).
- **Delivery** is handled by a lightweight delivery-partner role inside the same backend/admin surface in v1 (web-based order acceptance, not a native app) to keep scope shippable. A dedicated Delivery Partner Flutter app is explicitly deferred to the Post-MVP roadmap (Section 9).

If your actual intent is narrower (e.g., a single-canteen pre-order app for one campus with no multi-restaurant marketplace), most of this document still applies but Sections 5, 10, 13 and 14 would shrink significantly — flag it and I'll re-cut the doc.

---

## 1. Product Vision

QuickBite is a mobile-first food ordering platform that connects hungry customers with local restaurants and independent delivery partners, delivering an experience that is **fast, reliable, and trustworthy** from the first install. The long-term vision is to become the default food-ordering app for a defined local market (starting with a campus/college-town geography, expanding to city-wide) by winning on **speed of ordering, accuracy of delivery ETA, and payment reliability** — the three things that most consistently break trust in food-delivery apps.

QuickBite is built to be **operated as a real business**, not demoed once and abandoned: every architectural decision in this document optimizes for the app surviving contact with real users, real payments, and real Play Store review — not for the fastest path to a working prototype.

---

## 2. Problem Statement

| Problem | Evidence / Reasoning |
|---|---|
| Existing large platforms (Swiggy/Zomato) deprioritize small local markets (campuses, tier-2 towns) — poor restaurant density, high commission rates that push restaurants away, generic UX not tailored to a local audience. | Restaurants in small markets are commission-sensitive; large platforms take 18-25%, unsustainable for thin-margin local eateries. |
| Local restaurants often rely on phone-call ordering or WhatsApp — error-prone, no order history, no digital payment trail, no analytics. | No structured system = lost orders, disputes, no repeat-customer data for the restaurant. |
| Customers in local/campus markets want **fast, predictable delivery** more than infinite restaurant choice — large-platform UX (ads, upsells, wide catalog) adds friction for this segment. | Campus/local ordering is habitual (same 5-10 places), not discovery-driven. |
| Existing apps provide poor real-time visibility into order status once placed, leading to repeated "where is my order" support burden. | Directly addressed by Socket.IO-driven live order state in this design. |

**QuickBite's answer:** a leaner, lower-commission, faster marketplace focused on a defined local geography, with best-in-class order-status transparency and payment reliability.

---

## 3. Target Users

1. **Customers** — students, young professionals, and residents in the target geography who order food regularly (3+ times/week is the retention target segment).
2. **Restaurant Partners** — local restaurants, cafés, tiffin services, cloud kitchens that want digital ordering without enterprise-platform commission rates.
3. **Delivery Partners** — gig workers who accept and fulfill delivery orders (v1: web-based flow; native app in roadmap).
4. **Platform Admins** — internal operations team managing restaurant onboarding, dispute resolution, payouts, and platform health.

---

## 4. User Personas

### Persona 1 — "Ananya", the Customer
- 20, college student, orders food 4-5x/week between classes.
- Price-sensitive but values **speed and accuracy** over restaurant variety.
- Pain point: hates apps that show "20 min" and take 50.
- Needs: fast reorder of favorites, saved addresses (hostel/PG), UPI-first payment, live tracking.

### Persona 2 — "Rakesh", the Restaurant Owner
- 38, runs a 2-location tiffin/cloud-kitchen business.
- Not deeply technical; needs a **simple** order-management dashboard, not a complex ERP.
- Pain point: commission rates on big platforms eat his margin; frequent order-status confusion with delivery staff.
- Needs: clear order queue (new → preparing → ready), menu/inventory toggles (mark item out of stock in one tap), daily payout visibility.

### Persona 3 — "Imran", the Delivery Partner
- 24, gig worker, works across multiple platforms simultaneously.
- Needs: clear accept/reject flow, minimum friction to start earning, transparent per-order payout, low app resource usage (budget Android phones).

### Persona 4 — "Priya", the Platform Admin / Ops
- Internal team member responsible for onboarding restaurants, handling disputes/refunds, monitoring live order health.
- Needs: a dashboard showing order SLA breaches in real time, refund/dispute tools, restaurant performance metrics.

---

## 5. Functional Requirements

### 5.1 Authentication & Onboarding
- FR-1: Users register/login via phone number + OTP (primary) and email/password (secondary) using JWT-based session management.
- FR-2: Social login (Google) as a fast-path option.
- FR-3: Restaurant partners and delivery partners have separate onboarding flows with document upload (FSSAI license, ID proof) subject to admin approval before going live.
- FR-4: Refresh-token rotation with silent re-authentication; access tokens short-lived (15 min), refresh tokens long-lived (30 days) and revocable.

### 5.2 Discovery & Browsing
- FR-5: Location-based restaurant listing (geo-radius query from user's active address).
- FR-6: Search (restaurant name, cuisine, dish) with autocomplete.
- FR-7: Filters: cuisine, rating, price range, delivery time, veg/non-veg, offers.
- FR-8: Restaurant detail page: menu grouped by category, item customization (add-ons/variants), ratings/reviews.

### 5.3 Cart & Ordering
- FR-9: Single-restaurant cart (industry-standard constraint — cannot mix items from two restaurants in one order; adding from a new restaurant prompts cart-replace confirmation).
- FR-10: Item customization persisted per cart line (size, add-ons, spice level, special instructions).
- FR-11: Coupon/promo code application with server-side validation (never trust client-computed discount).
- FR-12: Delivery address selection/creation with map-pin drop + manual entry, address labels (Home/Hostel/Work).
- FR-13: Order summary with itemized cost breakdown: subtotal, delivery fee, platform fee, taxes, discount, tip, total.

### 5.4 Payments
- FR-14: Razorpay integration supporting UPI, cards, netbanking, wallets.
- FR-15: Server-side payment verification via Razorpay webhook signature validation — client-reported "success" is never trusted alone.
- FR-16: Idempotent order creation (prevents duplicate orders on double-tap/network retry).
- FR-17: Refund flow (full/partial) triggered by admin or automated cancellation rules, processed via Razorpay Refunds API.
- FR-18: Cash-on-Delivery (COD) as a configurable option (can be disabled platform-wide or per-restaurant).

### 5.5 Order Lifecycle & Real-Time Tracking
- FR-19: Order state machine: `PLACED → ACCEPTED → PREPARING → READY_FOR_PICKUP → OUT_FOR_DELIVERY → DELIVERED` (+ `CANCELLED`, `REJECTED` terminal states).
- FR-20: Real-time state updates pushed to customer app via Socket.IO (with FCM push as fallback when app is backgrounded/killed).
- FR-21: Live delivery-partner location updates during `OUT_FOR_DELIVERY` (periodic lat/lng emit, throttled to battery-friendly interval, e.g. every 8-10s).
- FR-22: Estimated Time of Arrival (ETA) calculation and display, recalculated as delivery progresses.
- FR-23: Order cancellation by customer (only allowed pre-`PREPARING`, with reason capture) and by restaurant (with mandatory reason + auto-refund trigger).

### 5.6 Notifications
- FR-24: Push notifications (FCM) for: order confirmed, order accepted/rejected, out-for-delivery, delivered, promotional (opt-out respected), payment failed.
- FR-25: In-app notification center with read/unread state, persisted server-side.

### 5.7 Ratings & Reviews
- FR-26: Post-delivery rating prompt (restaurant + delivery experience separately).
- FR-27: Written reviews with restaurant reply capability (via admin panel).

### 5.8 Restaurant Partner (Admin Panel)
- FR-28: Menu CRUD (categories, items, variants, add-ons, images, availability toggle).
- FR-29: Live order queue with sound/visual alert on new order; accept/reject with prep-time estimate.
- FR-30: Order history, daily sales summary, payout ledger.
- FR-31: Store open/close toggle (manual) + operating-hours schedule (automatic).

### 5.9 Platform Admin (Admin Panel)
- FR-32: Restaurant approval/rejection workflow (document review).
- FR-33: Delivery partner approval workflow.
- FR-34: Global order monitoring dashboard (SLA breach alerts, live order map).
- FR-35: Dispute/refund management console.
- FR-36: Coupon/promotion campaign creation.
- FR-37: Commission rate configuration per restaurant.
- FR-38: Analytics dashboard (GMV, order volume, active users, churn) — can start as a thin wrapper in v1 and grow later.

### 5.10 Delivery Partner (v1 — web-based within Admin Panel; native app deferred)
- FR-39: Order assignment (manual admin-assign in v1; auto-assign algorithm in Phase 2).
- FR-40: Accept/reject with countdown timer.
- FR-41: Status update (picked up / delivered) with OTP or photo-proof-of-delivery.

---

## 6. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Performance** | Cold start < 2.5s on mid-range Android (4GB RAM); API P95 latency < 400ms for read endpoints, < 800ms for order-write endpoints. |
| **Scalability** | Backend stateless and horizontally scalable behind a load balancer; MongoDB designed for read-heavy access patterns with proper indexing from day 1 (see Section 13). |
| **Availability** | Target 99.5% uptime for core ordering path (browse → cart → pay) in v1; payment webhook processing must be durable (queued, retried, never silently dropped). |
| **Security** | OWASP ASVS-aligned; see Section 19 in full. |
| **Maintainability** | Modular backend (feature-based, not layer-based, folder structure — Section 12); Riverpod-based clean architecture on Flutter (feature-first, no business logic in widgets). |
| **Observability** | Structured logging (JSON), centralized error tracking (Sentry/Crashlytics), request tracing via correlation IDs. |
| **Localization** | Architected for i18n from day 1 (all user-facing strings externalized) even if only English + one regional language ship in v1. |
| **Accessibility** | Minimum: proper contrast ratios, tappable target sizes ≥ 48dp, screen-reader labels on interactive elements — required for Play Store quality bar, not optional polish. |
| **Compliance** | PCI-DSS scope minimized by never touching raw card data (Razorpay Checkout SDK handles PCI surface entirely). Data retention & deletion policy for Play Store data-safety declaration. |
| **Battery/Data usage** | Socket connection lifecycle tied to app foreground state; location polling throttled; images served via CDN with responsive sizing. |

---

## 7. User Flow (Key Flows)

**7.1 First-Time Customer Flow**
Install → Splash → Location permission → Phone number → OTP verify → (optional) name/profile → Home (restaurant list for detected location) → Browse restaurant → Add items to cart → Cart review → Select/add address → Apply coupon (optional) → Payment (Razorpay sheet) → Order confirmation → Live tracking screen → Delivered → Rating prompt.

**7.2 Returning Customer Flow**
Open app (auto-login via refresh token) → Home (last-used address pre-selected) → Reorder from history OR browse → Cart → Checkout → Payment → Tracking.

**7.3 Restaurant Partner Flow**
Login (Next.js admin) → Dashboard → New order notification (sound alert) → Review order → Accept + set prep time → Mark "Ready for pickup" → (delivery partner picks up) → Order closes → Appears in payout ledger.

**7.4 Delivery Partner Flow (v1, web-based)**
Login → Available-orders queue → Accept order (countdown to respond) → Navigate to restaurant (external maps deep-link) → Mark "Picked up" → Navigate to customer → Mark "Delivered" (OTP/photo proof) → Next order.

**7.5 Payment Failure / Retry Flow**
Checkout → Razorpay sheet → Payment fails/cancelled → Order left in `PAYMENT_PENDING` state (not `PLACED`) → User prompted to retry within cart-hold window (e.g. 10 min) → On success, webhook confirms → order transitions to `PLACED`. This decouples "money received" from "order accepted," which is the single most important correctness rule in the whole system.

---

## 8. Complete Feature List

### MVP (v1 — required to launch)
- Phone OTP + Google auth, JWT sessions
- Location-based restaurant discovery, search, filters
- Menu browsing with customization
- Single-restaurant cart, coupons
- Razorpay checkout (UPI/card/netbanking) + COD toggle
- Order state machine + Socket.IO live tracking + FCM notifications
- Ratings & reviews
- Restaurant admin panel: menu CRUD, order queue, payouts view
- Platform admin panel: restaurant/delivery approval, dispute console, coupon management
- Delivery partner web flow (manual/simple assignment)
- Basic analytics dashboard

### Post-MVP (Phase 2)
- Native Delivery Partner Flutter app
- Auto-assignment algorithm for delivery partners (distance + load balancing)
- In-app chat (customer ↔ delivery partner ↔ restaurant) via Socket.IO
- Loyalty/rewards program
- Scheduled/pre-orders ("order for 8 PM")
- Multi-address saved book with favorites
- Advanced analytics & cohort reporting for admin
- Referral program

### Phase 3+ (Scale)
- Multi-city expansion tooling (city-based config, dynamic commission rules)
- AI-based recommendation engine
- Subscription plans (QuickBite Plus — free delivery tier)
- Dark-store/inventory model support (grocery-adjacent expansion)
- Voice ordering / chatbot support

---

## 9. Future Roadmap

| Horizon | Focus |
|---|---|
| **0-3 months** | MVP launch in a single target geography (e.g., one campus/town), core ordering + payments + tracking rock-solid. |
| **3-6 months** | Delivery partner native app, auto-assignment, chat, loyalty basics. Expand to 2-3 adjacent geographies. |
| **6-12 months** | Multi-city support, subscription tier, recommendation engine v1, advanced admin analytics. |
| **12+ months** | Platform maturity: dark-store/grocery vertical exploration, deeper personalization, potential B2B (catering/bulk orders) module. |

---

## 10. System Architecture

**Architectural style:** Modular monolith backend (not microservices) for v1. Reasoning: a startup at this stage does not have the ops maturity or team size to justify microservices' operational overhead (service discovery, distributed tracing, inter-service auth). A well-modularized monolith with clear internal boundaries (auth, catalog, orders, payments, notifications, delivery) can be split into services later **only if a specific module becomes a genuine scaling bottleneck** — premature microservices are a top cause of startup engineering time waste.

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────────┐
│  Flutter App      │     │  Next.js Admin   │     │  (Future) Delivery  │
│  (Customer)        │     │  (Restaurant +   │     │  Partner App        │
│                     │     │   Platform Admin)│     │  (Flutter, Phase 2) │
└─────────┬───────────┘     └─────────┬─────────┘     └──────────┬─────────┘
          │  REST (Dio) + WebSocket    │  REST (fetch) + WS       │
          └─────────────┬──────────────┴───────────────┬──────────┘
                         │                              │
                ┌────────▼──────────────────────────────▼───────┐
                │      Node.js / Express API Gateway Layer        │
                │  (Auth middleware, rate limiting, validation)   │
                └────────┬─────────────────────┬─────────────────┘
                         │                       │
             ┌───────────▼───────────┐  ┌────────▼────────────┐
             │  Core Modules (monolith)│  │  Socket.IO Server    │
             │  auth / catalog / orders│  │  (order events, live │
             │  payments / delivery /  │  │  tracking, chat)      │
             │  notifications / admin  │  └────────┬─────────────┘
             └───────────┬───────────┘             │
                         │                          │
        ┌────────────────┼──────────────────────────┼───────────────┐
        │                │                          │               │
┌───────▼──────┐ ┌────────▼────────┐ ┌───────▼───────┐ ┌───────▼───────┐
│   MongoDB      │ │  Redis (cache,   │ │  Razorpay API   │ │  Firebase FCM   │
│   (Atlas)       │ │  session/OTP,    │ │  (payments,     │ │  (push           │
│                 │ │  Socket.IO       │ │  webhooks)      │ │  notifications)  │
│                 │ │  adapter for      │ │                 │ │                  │
│                 │ │  multi-instance)  │ │                 │ │                  │
└─────────────────┘ └───────────────────┘ └─────────────────┘ └──────────────────┘
```

**Key architectural decisions:**
- **Redis is added** beyond the originally listed stack — required for: OTP storage with TTL, Socket.IO horizontal-scaling adapter (without it, Socket.IO cannot scale past one Node instance), and hot-path caching (restaurant listings). This is a necessary addition to make the stated stack production-viable, not scope creep.
- **Webhook-first payment confirmation:** the backend never marks an order "paid" from a client callback alone; Razorpay's server-to-server webhook (signature-verified) is the source of truth. Client callback only improves perceived latency.
- **Message queue (BullMQ on Redis) for async jobs**: notification fan-out, payout calculation, receipt generation — kept off the request/response critical path.
- **CDN (Cloudinary or S3+CloudFront)** for restaurant/menu images — never serve images from the app server directly.

---

## 11. Technology Stack

| Layer | Technology | Justification |
|---|---|---|
| Mobile App | Flutter (latest stable) | Cross-platform, single codebase, strong ecosystem. |
| State Management | Riverpod | Compile-safe DI, testable, scales better than Provider/BLoC boilerplate for a team of this size. |
| Routing | GoRouter | Declarative, deep-link friendly (needed for order-tracking push-notification deep links), official Flutter team support. |
| HTTP Client | Dio | Interceptors for auth-token refresh, logging, retry — essential for production reliability. |
| Backend Runtime | Node.js + Express.js | Fast to build, huge ecosystem, team already targeting JS/TS across stack (shared types possible with admin panel). |
| Language (backend) | TypeScript (recommended addition) | Type safety across a growing codebase is a maintainability necessity — strongly recommended even though not explicitly listed. |
| Database | MongoDB (Atlas) | Flexible schema fits evolving menu/order structures; document model matches order-as-aggregate well. |
| Cache/Session/Queue | Redis | OTP storage, Socket.IO scaling, BullMQ job queue. |
| Auth | JWT (access + refresh) | Stateless, scalable; refresh tokens stored hashed in DB for revocation capability. |
| Real-time | Socket.IO | Order status push, live location, future chat. |
| Push Notifications | Firebase Cloud Messaging | Reliable background delivery, required for order-status alerts when app is killed. |
| Payments | Razorpay | UPI-first (dominant in target market), webhook-based verification, refund API. |
| Admin Panel | Next.js | SSR for admin dashboards, API routes can proxy/aggregate backend calls, good DX. |
| File/Image Storage | Cloudinary or AWS S3 + CloudFront | Offloads image serving, on-the-fly resizing. |
| Hosting (Backend) | AWS/GCP (e.g., ECS/Cloud Run) or Render/Railway for early stage | Containerized deployment from day 1 for portability. |
| CI/CD | GitHub Actions | Automated build/test/lint/deploy pipelines for all three codebases. |
| Monitoring | Sentry (app + backend crash/error), Firebase Crashlytics (mobile), simple uptime monitor (e.g. UptimeRobot/BetterStack) | Non-negotiable for a "production-ready" claim. |
| Testing | Flutter: `flutter_test` + `mocktail`/`mockito`, integration_test. Backend: Jest/Vitest + Supertest. | Required for CI gating. |

---

## 12. Folder Structure (described, no code)

**12.1 Flutter App — Feature-First Clean Architecture**
```
lib/
  core/            → shared utilities: theme, constants, error handling, network client setup, extensions
  config/          → environment config (dev/staging/prod), GoRouter setup, DI/provider setup
  features/
    auth/          → data / domain / presentation sublayers per feature
    home_discovery/
    restaurant_menu/
    cart/
    checkout_payment/
    order_tracking/
    notifications/
    profile_addresses/
    ratings_reviews/
  shared_widgets/  → reusable UI components (buttons, cards, loaders, error states)
  l10n/            → localization resources
```
Each feature follows `data/ (remote datasource, repository impl) → domain/ (entities, repository interfaces, use cases) → presentation/ (Riverpod providers, screens, widgets)`. This keeps business logic testable independent of UI and swappable independent of backend changes.

**12.2 Node/Express Backend — Modular Monolith, Feature-Based**
```
src/
  config/          → env, db connection, redis connection, third-party client setup
  modules/
    auth/          → controller, service, model, validation, routes
    users/
    restaurants/
    catalog/        (menu items, categories)
    orders/
    payments/
    delivery/
    notifications/
    reviews/
    admin/
  middlewares/     → auth guard, error handler, rate limiter, request validator
  jobs/            → BullMQ queue processors (notification fan-out, payout calc)
  sockets/         → Socket.IO event handlers, namespace/room logic
  utils/
  tests/
```
Feature-based (not `controllers/`, `models/`, `routes/` split across the whole app) so a module can eventually be extracted into its own service without a full rewrite.

**12.3 Next.js Admin Panel**
```
app/ (or pages/)
  (restaurant)/    → restaurant-partner-scoped routes, role-gated
  (platform-admin)/ → platform-admin-scoped routes, role-gated
  api/             → BFF routes if aggregation/proxying is needed
components/
lib/               → API client, auth helpers, shared types (ideally shared with backend via a types package)
```

---

## 13. Database Design (MongoDB)

**Design principle:** model around access patterns (how the app reads data), not pure normalization. Embed what's read together; reference what's large, shared, or independently updated.

### Core Collections

**users**
`_id, phone, email, passwordHash?, name, role (customer|restaurant_owner|delivery_partner|admin), addresses[] (embedded: label, geo point, formatted address), fcmTokens[], createdAt, isActive`

**restaurants**
`_id, ownerUserId (ref users), name, description, cuisineTags[], location (GeoJSON Point, indexed 2dsphere), address, operatingHours, isOpen, avgRating, ratingCount, commissionRate, fssaiLicenseUrl, status (pending|approved|rejected|suspended), bannerImageUrl`

**menu_items** (referenced from restaurant, not embedded — grows large, updated independently)
`_id, restaurantId (ref, indexed), name, description, price, category, imageUrl, variants[] {name, priceDelta}, addOns[] {name, price}, isVeg, isAvailable, createdAt`

**orders** (the central aggregate — heavily embedded for read performance since an order is read as a whole unit)
`_id, orderNumber (human-readable), customerId, restaurantId, deliveryPartnerId?, items[] (embedded snapshot: itemId, name, price, qty, variant, addOns — snapshotted at order time so later menu price changes don't retroactively alter past orders), addressSnapshot (embedded), pricing {subtotal, deliveryFee, platformFee, tax, discount, tip, total}, couponCode?, paymentStatus (pending|paid|failed|refunded), paymentId (ref payments), orderStatus (state machine value), statusHistory[] {status, timestamp, actorId}, createdAt, deliveredAt?`

**payments**
`_id, orderId (ref, indexed), razorpayOrderId, razorpayPaymentId, razorpaySignature, amount, status, method, webhookVerifiedAt, refunds[] {amount, reason, status, refundedAt}`

**reviews**
`_id, orderId (ref), customerId, restaurantId, restaurantRating, deliveryRating, comment, restaurantReply?, createdAt`

**coupons**
`_id, code (unique, indexed), discountType (flat|percent), value, minOrderValue, maxDiscount, validFrom, validTo, usageLimitPerUser, applicableRestaurantIds[]?, isActive`

**notifications**
`_id, userId (indexed), title, body, type, isRead, relatedOrderId?, createdAt`

**delivery_partners** (extends users with role-specific fields, kept separate to avoid bloating `users`)
`_id, userId (ref), vehicleType, idProofUrl, status (pending|approved|suspended), isOnline, currentLocation (GeoJSON Point, indexed 2dsphere), rating`

### Key Indexes
- `restaurants`: `2dsphere` on `location`; compound `{status, isOpen}`.
- `menu_items`: `{restaurantId, isAvailable}`.
- `orders`: `{customerId, createdAt: -1}`, `{restaurantId, orderStatus}`, `{deliveryPartnerId, orderStatus}`.
- `payments`: unique index on `razorpayOrderId`.
- `coupons`: unique index on `code`.
- `delivery_partners`: `2dsphere` on `currentLocation` for nearest-partner assignment queries.

### Data-integrity rules
- Order pricing is **always recalculated server-side** at checkout time from live menu prices + coupon rules — client-submitted totals are never trusted.
- Order `items[]` are a **snapshot**, not a live reference, so historical orders remain accurate regardless of later menu edits.

---

## 14. API Planning

**Conventions:** REST, versioned under `/api/v1/`, JSON, JWT bearer auth on protected routes, consistent error envelope `{ success, error: { code, message } }`, pagination via `?page&limit` with `{ data, meta: { total, page, hasMore } }`.

### Auth
`POST /auth/otp/request` · `POST /auth/otp/verify` · `POST /auth/google` · `POST /auth/refresh` · `POST /auth/logout`

### Users
`GET /users/me` · `PATCH /users/me` · `POST /users/me/addresses` · `PATCH/DELETE /users/me/addresses/:id`

### Restaurants & Catalog
`GET /restaurants?lat&lng&radius&filters` · `GET /restaurants/:id` · `GET /restaurants/:id/menu`
(Restaurant-partner-scoped, role-gated:) `POST/PATCH/DELETE /restaurants/:id/menu-items` · `PATCH /restaurants/:id/status` (open/close)

### Cart/Order Pricing (stateless preview, no persistence until checkout)
`POST /orders/preview` — computes pricing breakdown server-side given cart + coupon + address, before payment.

### Orders
`POST /orders` (creates order in `PAYMENT_PENDING`, returns Razorpay order id) · `GET /orders/:id` · `GET /orders/mine` · `PATCH /orders/:id/cancel`
(Restaurant-partner:) `PATCH /orders/:id/accept` · `PATCH /orders/:id/reject` · `PATCH /orders/:id/status`
(Delivery-partner:) `PATCH /orders/:id/pickup` · `PATCH /orders/:id/deliver`

### Payments
`POST /payments/webhook` (Razorpay server-to-server, signature-verified, **no auth header** — verified via HMAC signature instead) · `POST /payments/:orderId/retry` · `POST /payments/:orderId/refund` (admin only)

### Reviews
`POST /orders/:id/review` · `GET /restaurants/:id/reviews`

### Admin
`GET /admin/restaurants/pending` · `PATCH /admin/restaurants/:id/approve` · `GET /admin/delivery-partners/pending` · `PATCH /admin/delivery-partners/:id/approve` · `GET /admin/orders/live` · `POST /admin/coupons` · `GET /admin/analytics/summary`

### Socket.IO Events
- **Client → Server:** `join_order_room {orderId}`, `partner_location_update {orderId, lat, lng}` (delivery partner only)
- **Server → Client:** `order_status_changed {orderId, status, timestamp}`, `partner_location {orderId, lat, lng}`, `new_order` (to restaurant room, on order creation)

Rooms are scoped per `orderId` (customer + assigned delivery partner + restaurant join the same room) so events are never broadcast wider than necessary.

---

## 15. UI/UX Planning

**Design principles:** speed-of-task over visual flourish (aligned to Persona 1's priority); consistent, minimal design system; every async action has a visible loading/error/empty state — no silent failures.

**Core screen inventory:**
Splash → Onboarding/permissions → Auth (phone/OTP, Google) → Home (address bar, search, restaurant list, banners/offers) → Restaurant detail (menu, item customization sheet) → Cart → Address select/add (map picker) → Checkout summary → Payment (Razorpay sheet) → Order confirmation → Live order tracking (map + status timeline) → Order history → Order detail/reorder → Ratings/review submission → Profile → Saved addresses → Notifications center → Settings.

**Design system foundations (to formalize before UI build):**
- Typography scale, color palette (with light/dark mode from day 1 — Play Store users expect it), spacing scale (4/8pt grid), elevation/shadow rules, component library (buttons, chips/filters, cards, bottom sheets, snackbars/toasts, skeleton loaders).
- Skeleton loading states for restaurant list/menu (not spinners) — perceived-performance best practice for this category of app.
- Empty states designed explicitly (empty cart, no restaurants in area, no order history, connectivity lost).

**UX-critical flows requiring extra design attention:**
- Item customization bottom sheet (variants/add-ons) — must be fast, thumb-reachable.
- Live tracking screen — the single highest-engagement screen in the app; needs a map + clear status timeline + ETA + contact/support access.
- Payment failure/retry — must never leave the user unsure whether they were charged.

---

## 16. Development Phases

| Phase | Duration (est.) | Scope |
|---|---|---|
| **Phase 0 — Foundation** | 2 weeks | Repo setup (3 codebases), CI/CD skeleton, environment config, design system tokens, backend project scaffold with auth module, Flutter app scaffold with GoRouter/Riverpod wiring, DB schema finalization. |
| **Phase 1 — Core Ordering** | 4-5 weeks | Auth (OTP/Google), restaurant discovery, menu browsing, cart, address management, order-preview pricing endpoint. |
| **Phase 2 — Payments & Order Lifecycle** | 3-4 weeks | Razorpay integration + webhook handling, order state machine, Socket.IO live status, FCM notifications. |
| **Phase 3 — Admin Panel (Restaurant + Platform)** | 4 weeks (can partially overlap Phase 1-2) | Next.js admin: menu CRUD, order queue, restaurant/delivery approval, dispute console, coupon management, basic analytics. |
| **Phase 4 — Delivery Flow (v1, web-based)** | 2 weeks | Delivery-partner web flow, manual assignment, pickup/delivery status updates. |
| **Phase 5 — Ratings, Polish, Hardening** | 3 weeks | Reviews, notification center, empty/error states pass, accessibility pass, security review, load testing. |
| **Phase 6 — Play Store Readiness** | 2 weeks | Play Store listing assets, data-safety form, closed testing track, crash-free rate validation, staged rollout plan. |

**Total estimate to v1 launch: ~20-24 weeks** for a small focused team (2-3 backend/full-stack + 1-2 Flutter + 1 designer, part-time PM/QA). Adjust down if team is larger, but do not compress Phase 2 (payments) or Phase 5 (hardening) — these are the phases where cut corners become production incidents.

---

## 17. Milestones

Assuming a start date around **2026-07-27** (allowing ~1 week for final scope sign-off after this document):

| Milestone | Target Date |
|---|---|
| M1 — Repo/CI/design-system foundation complete | 2026-08-10 |
| M2 — Auth + discovery + menu browsing functional (internal build) | 2026-09-14 |
| M3 — End-to-end order with real Razorpay payment (test mode) working | 2026-10-12 |
| M4 — Admin panel MVP usable by a real restaurant partner in staging | 2026-11-09 |
| M5 — Delivery flow + full order lifecycle working end-to-end | 2026-11-23 |
| M6 — Feature-complete build enters internal QA + security review | 2026-12-14 |
| M7 — Closed testing track live on Play Store (real users, limited geography) | 2026-12-28 |
| M8 — Public launch (single geography) | 2027-01-18 |

(Dates are planning estimates, not commitments — re-baseline once team size/velocity is known after Phase 0.)

---

## 18. Risks and Challenges

| Risk | Impact | Mitigation |
|---|---|---|
| Payment webhook reliability (missed/delayed webhook = paid order stuck as pending) | High — direct revenue/trust impact | Idempotent webhook handler, retry-safe design, reconciliation job that polls Razorpay for orders stuck >N minutes in `PAYMENT_PENDING`. |
| Socket.IO scaling once >1 backend instance runs | Medium — breaks live tracking silently | Redis adapter from day 1 (Section 10), load-test before scaling instance count. |
| Cold-start liquidity problem (no restaurants → no customers → no restaurants) | High — core marketplace risk, not engineering | Product/ops strategy: manually onboard a critical mass of restaurants in one tight geography before public launch (not an engineering fix). |
| Delivery partner supply/reliability in v1 (web-based, manual assignment) | Medium — poor delivery UX undermines the whole value prop | Keep v1 launch geography small enough that manual/semi-manual assignment is operationally feasible; fast-track native delivery app if volume outpaces manual ops. |
| Play Store policy compliance (data safety, permissions justification, payment flow review) | High — can block launch entirely | Address data-safety form and permission justifications during Phase 6, not as an afterthought; avoid requesting permissions not strictly used. |
| MongoDB schema drift as features grow | Medium — long-term maintainability | Enforce schema validation at the application layer (e.g., Zod/Joi + Mongoose schemas), not "MongoDB is schemaless so anything goes." |
| Refund/dispute abuse (fake "not delivered" claims) | Medium — financial leakage | Photo/OTP proof-of-delivery (FR-41), dispute console with evidence trail (Section 5.9). |
| Team underestimating payments/security phase | High | Explicit non-negotiable time allocation in Section 16 (Phases 2 & 5). |

---

## 19. Security Considerations

- **Transport:** TLS everywhere (HTTPS/WSS only), HSTS on admin panel and API.
- **Auth:** JWT access tokens short-lived; refresh tokens stored **hashed** server-side, rotated on use, revocable (logout-everywhere capability). OTP rate-limited and expiring (e.g., 5 min TTL, max 3 attempts).
- **Input validation:** Schema validation (Zod/Joi) on every request body/param at the API boundary — never trust client input, especially pricing/quantity fields.
- **Authorization:** Role-based access control enforced server-side on every endpoint (customer/restaurant/delivery/admin) — role checks never inferred from client-sent data.
- **Payment integrity:** Razorpay webhook signature (HMAC-SHA256) verified on every webhook call; webhook endpoint excluded from generic auth middleware but protected by signature check instead; raw card data never touches QuickBite servers (PCI scope stays with Razorpay Checkout).
- **Secrets management:** No secrets in source control; environment-based secret injection (e.g., AWS Secrets Manager/GCP Secret Manager or at minimum encrypted `.env` handling in CI).
- **Rate limiting & abuse prevention:** IP + user-based rate limits on auth/OTP endpoints and order-creation endpoint (prevent coupon-abuse scripting and OTP-bombing).
- **Data protection:** PII (phone, address) access-logged for admin views; encryption at rest via MongoDB Atlas default encryption; principle of least privilege for admin roles (platform admin vs. restaurant-scoped admin must not see other restaurants' data — enforced via query-level scoping, not just UI hiding).
- **Mobile app hardening:** certificate pinning (optional but recommended for payment-adjacent traffic), no sensitive data in plain SharedPreferences (use secure storage for tokens), obfuscated release builds.
- **Dependency hygiene:** automated dependency vulnerability scanning (`npm audit`/Dependabot, `flutter pub outdated` review) as a CI gate.
- **Play Store requirements:** target-API-level compliance kept current, Play Integrity API considered for anti-tampering on payment flows, clear privacy policy matching actual data collection (data-safety form must not misrepresent behavior — this is actively enforced by Google).

---

## 20. Performance Strategy

- **Backend:** proper MongoDB indexing (Section 13) validated via `explain()` on hot queries before launch; Redis caching for restaurant-listing queries (short TTL, invalidated on restaurant/menu update); connection pooling tuned; N+1 query patterns eliminated via aggregation pipelines/populate batching.
- **API design:** pagination on every list endpoint by default; field projection (don't return full menu-item documents where a summary suffices); gzip/br compression on API responses.
- **Real-time:** Socket.IO location-update throttling (Section 6); room-scoped event emission (never broadcast globally); Redis adapter for multi-instance scaling.
- **Mobile app:** image caching (`cached_network_image`), lazy-loaded lists (pagination/infinite scroll for restaurant and order-history lists), skeleton loaders over spinners, minimized rebuild scope via granular Riverpod providers (avoid whole-screen rebuilds on small state changes), release-mode profiling before launch (`flutter build --profile` + DevTools) to catch jank on the critical browse/checkout paths.
- **Assets/CDN:** all images served via CDN with on-the-fly resizing (never ship full-resolution restaurant photos to a mobile list view); lazy image loading below the fold.
- **Admin panel (Next.js):** SSR/ISR for dashboard pages where data isn't hyper-real-time; client-side polling or socket subscription only for the live-order-monitoring view.
- **Load testing:** before public launch, load-test the order-creation + payment-webhook path specifically (the path most likely to be hit hard during a promo/launch spike) using k6 or Artillery against a staging environment sized like production.

---

## Open Questions for Stakeholder Sign-off

Before Phase 0 begins, these decisions should be explicitly confirmed (not assumed further):

1. **Launch geography scope** — single campus, single town, or multi-area from day 1? (Drives Section 18's cold-start-liquidity strategy and Phase 6 rollout plan.)
2. **Delivery model confirmation** — is QuickBite operating its own delivery fleet (this document's assumption) or is delivery restaurant-managed (self-delivery), which would remove/shrink Section 5.10 and the delivery-partner role entirely?
3. **COD support** — is cash-on-delivery a hard requirement for launch, or can v1 be online-payment-only to simplify Phase 2?
4. **Team size/composition** — needed to re-baseline the Section 16/17 estimates realistically.
5. **Brand/legal entity readiness** — Play Store developer account, business registration for Razorpay live-mode activation (Razorpay requires KYC/business verification before going beyond test mode) — this can be a launch-blocking lead time item if not started early.

---

*End of document. This is a living document — expect it to be revised after Phase 0 as real constraints surface.*
