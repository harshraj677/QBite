# QBite — Development Roadmap

**Purpose:** phase-by-phase execution plan from engineering foundation through production release. This roadmap operationalizes [`QBite_SRS_PRD.md` §16-17](../QBite_SRS_PRD.md) into concrete phase deliverables — durations and sequencing are consistent with that document, not a re-estimate.
**No code, UI, or APIs are produced until Phase 3.** Phases 1-2 are documentation, tooling, and scaffolding only.

---

## Phase 1 — Engineering Foundation & Planning

**Status: in progress (this phase).**

**Goal:** Establish the complete product and engineering foundation — requirements, architecture, standards, and repository structure — before any business logic is written, so every later decision has a documented reference to align to.

**Deliverables:**
- Product Requirement Document & Software Requirements Specification (`QBite_SRS_PRD.md`)
- Git repository initialized and connected to GitHub, branding finalized
- `ARCHITECTURE.md`, `DATABASE_DESIGN.md`, `API_SPECIFICATION.md`, `CODING_STANDARDS.md`, `CONTRIBUTING.md`
- This roadmap

**Expected Outcome:** Any engineer joining the project can read `/docs` and understand what QBite is, how it's architected, how data is modeled, how the API is shaped, and how to contribute — without needing a verbal handoff.

---

## Phase 2 — Repository & Tooling Scaffold

**Goal:** Stand up the three application skeletons (mobile, backend, admin) and the CI/CD pipelines that will enforce the standards defined in Phase 1, before feature work begins.

**Deliverables:**
- Monorepo folder structure created per [`ARCHITECTURE.md §8`](./ARCHITECTURE.md#8-folder-structure-repository-level) (`mobile/`, `backend/`, `admin/`)
- Flutter project initialized (latest stable), Riverpod + GoRouter + Dio wired with empty/placeholder structure matching the feature-first layout
- Node/Express + TypeScript project initialized, modular-monolith folder scaffold, environment config validation, database connection to MongoDB Atlas, Redis connection
- Next.js admin project initialized, role-scoped route groups scaffolded
- CI pipelines (GitHub Actions) per app: lint, format check, test runner, build check — path-filtered so each app's pipeline only runs on its own changes
- Environment strategy set up: `development`, `staging`, `production` configs and secret handling
- Design-system tokens defined (colors, typography, spacing) for the mobile app, per [`QBite_SRS_PRD.md §15`](../QBite_SRS_PRD.md)

**Expected Outcome:** All three apps build, lint, and pass an empty test suite in CI. A new engineer can clone the repo, run each app locally, and see a blank-but-running shell — the foundation is provably solid before a single feature is built on top of it.

---

## Phase 3 — Backend Core: Auth & Platform Primitives

**Goal:** Implement the authentication system and cross-cutting backend primitives every later feature depends on.

**Deliverables:**
- `auth` module: OTP request/verify, JWT issuance, refresh-token rotation, logout/logout-everywhere
- `users` module: profile CRUD, address management
- Middleware pipeline: auth guard, RBAC, validation, rate limiting, centralized error handling — per [`ARCHITECTURE.md §3.2`](./ARCHITECTURE.md#32-middleware-pipeline)
- Standard response/error envelope implemented per [`API_SPECIFICATION.md §4-5`](./API_SPECIFICATION.md#4-response-format)
- Structured logging with correlation IDs

**Expected Outcome:** A user can register/login via OTP against a real deployed staging backend and receive a working, refreshable session. Every subsequent module builds on this without re-solving auth.

---

## Phase 4 — Mobile Foundation & Discovery

**Goal:** Build the mobile app's foundational shell and the restaurant discovery experience — the first screens a real user sees.

**Deliverables:**
- Mobile: auth screens (OTP flow, Google sign-in), app shell, GoRouter route table with auth guards
- Backend: `restaurants` and `catalog` modules — geo-radius discovery query, search, filters, menu browsing endpoints
- Mobile: home/discovery screen, restaurant detail + menu screen, with full loading/empty/error state handling per [`CODING_STANDARDS.md §2`](./CODING_STANDARDS.md#2-flutter-conventions)

**Expected Outcome:** A logged-in user can open the app, see nearby restaurants (real geospatial query against seeded staging data), and browse a live menu end-to-end.

---

## Phase 5 — Cart, Checkout & Order Creation

**Goal:** Implement the path from menu to a created (unpaid) order — cart logic, address selection, server-side pricing.

**Deliverables:**
- Mobile: cart (single-restaurant constraint), item customization, address selection/creation with map picker
- Backend: `orders` module — order-preview pricing endpoint (server-recalculated), order creation in `PAYMENT_PENDING` state, coupon validation
- Backend: `coupons` module

**Expected Outcome:** A user can build a cart, apply a coupon, select an address, and reach a checkout summary with a trustworthy, server-verified total — the last step before real money is involved.

---

## Phase 6 — Payments & Order Lifecycle

**Goal:** Wire real payment processing and the full order state machine — the highest-risk, highest-rigor phase in the roadmap (per [`QBite_SRS_PRD.md §16`](../QBite_SRS_PRD.md), this phase's time allocation is non-negotiable).

**Deliverables:**
- Razorpay Checkout integration (mobile) in test mode
- Backend: `payments` module — order creation against Razorpay, webhook endpoint with signature verification, refund handling
- Order state machine implementation (`PLACED → ACCEPTED → PREPARING → READY_FOR_PICKUP → OUT_FOR_DELIVERY → DELIVERED`) with `statusHistory` audit trail
- Socket.IO real-time layer: Redis adapter, order-room scoping, `order_status_changed` events
- FCM push notification dispatch (via BullMQ job queue) as the backgrounded-app fallback
- Payment-reconciliation sweep job for orders stuck in `PAYMENT_PENDING`

**Expected Outcome:** A user can pay for a real order (Razorpay test mode), see live status updates on a tracking screen without refreshing, and receive a push notification if the app is backgrounded — with payment state that is provably correct even under network retries and duplicate webhook delivery.

---

## Phase 7 — Admin Panel: Restaurant & Platform Operations

**Goal:** Give restaurant partners and platform admins the tools to operate the marketplace generated by Phases 3-6.

**Deliverables:**
- Next.js: restaurant-partner-scoped surface — menu CRUD, live order queue with new-order alerting, accept/reject/status-update actions, payout ledger view
- Next.js: platform-admin-scoped surface — restaurant/delivery-partner approval workflow, live order monitoring, dispute/refund console, coupon campaign management
- Backend: `admin` module endpoints backing all of the above, with server-side data scoping (a restaurant partner's queries are scoped to their own restaurant regardless of what the client requests)

**Expected Outcome:** A restaurant partner can log in, manage their live menu, and process real orders end-to-end from the admin panel; a platform admin can approve a new restaurant and monitor live order health across the marketplace.

---

## Phase 8 — Delivery Flow (v1)

**Goal:** Close the loop from "ready for pickup" to "delivered," per the v1 web-based delivery model defined in [`QBite_SRS_PRD.md` Scoping Assumption](../QBite_SRS_PRD.md).

**Deliverables:**
- Backend: `delivery` module — delivery-partner onboarding/approval, order assignment (manual in v1), pickup/deliver status transitions, OTP/photo proof-of-delivery
- Admin panel: delivery-partner-facing web flow (available-orders queue, accept/reject, status updates)
- Mobile: live delivery-partner location on the tracking screen (Socket.IO `partner_location_update`)

**Expected Outcome:** A full order can be tracked from placement through a real (manually-assigned) delivery to confirmed delivery, visible live on the customer's tracking screen.

---

## Phase 9 — Ratings, Notifications & UX Polish

**Goal:** Complete the remaining MVP feature surface and bring UX quality up to a shippable bar.

**Deliverables:**
- Ratings & reviews (restaurant + delivery, separate ratings) with restaurant-reply capability in admin
- In-app notification center
- Full pass on empty/error/loading states across every screen (audit against [`CODING_STANDARDS.md §2`](./CODING_STANDARDS.md#2-flutter-conventions))
- Accessibility pass (contrast, tap targets, screen-reader labels)
- Dark mode

**Expected Outcome:** The app feels finished, not just functional — no dead-end screens, no unhandled failure states, no accessibility blockers for Play Store review.

---

## Phase 10 — Security, Performance & Hardening

**Goal:** Validate the system under adversarial and high-load conditions before real users and real money are exposed to it at scale — the second non-negotiable-time phase per the PRD.

**Deliverables:**
- Security review against [`QBite_SRS_PRD.md §19`](../QBite_SRS_PRD.md) checklist (auth, RBAC, input validation, webhook signature verification, secrets handling, rate limiting)
- Dependency vulnerability scan resolved (`npm audit`/Dependabot, `flutter pub outdated`)
- Load testing of the order-creation + payment-webhook path (k6/Artillery) against a production-sized staging environment
- Index/query performance validation (`explain()`) on all hot-path queries per [`DATABASE_DESIGN.md §4`](./DATABASE_DESIGN.md#4-indexes)
- Crash/error monitoring wired end-to-end (Sentry, Crashlytics) with alerting

**Expected Outcome:** The system has been deliberately attacked and deliberately overloaded in a controlled environment, and the specific failure modes found have been fixed — not assumed away.

---

## Phase 11 — Play Store Readiness & Closed Testing

**Goal:** Meet Google Play's actual submission bar and validate with a real, limited external user group before public launch.

**Deliverables:**
- Play Store listing assets (screenshots, description, privacy policy matching actual data collection)
- Data-safety form completed accurately against real app behavior
- Signed release build, closed testing track live
- Real restaurant partners onboarded in the launch geography (operational readiness, not engineering — see [`QBite_SRS_PRD.md §18`](../QBite_SRS_PRD.md) cold-start-liquidity risk)
- Crash-free-rate and core-flow success-rate thresholds monitored during closed testing

**Expected Outcome:** A defined cohort of real external users successfully places and receives real orders through the Play Store closed-testing build, with monitoring confirming stability.

---

## Phase 12 — Production Release

**Goal:** Public launch in the initial target geography.

**Deliverables:**
- Staged rollout (percentage-based release) on Play Store
- Production monitoring dashboards live and owned (uptime, error rate, payment success rate, order SLA breaches)
- Support/on-call process defined for launch-week incident response
- Post-launch feedback loop established (in-app feedback, review monitoring)

**Expected Outcome:** QBite is live, discoverable, and operating as a real business in its first market — with the observability in place to know immediately if something breaks, not to find out from a one-star review.

---

## Sequencing Notes

- Phases 3-6 (backend core → payments) are strictly sequential — each depends on the previous. Phase 7 (admin panel) can begin in parallel with Phase 5-6 once the underlying `orders`/`restaurants` data model is stable, per [`QBite_SRS_PRD.md §16`](../QBite_SRS_PRD.md)'s overlap note.
- Phases 9-10 (polish, hardening) are **not optional tail work** — they are where most real-world production incidents are prevented, and are scheduled with explicit, protected time rather than being the first thing cut under deadline pressure.
- This roadmap will be revisited and re-baselined after Phase 2, once real team velocity is observable — the phase *sequence* and *scope* are the durable part of this document; specific durations are estimates.
