# QBite

QBite is a single-tenant campus canteen ordering platform: a Node.js/Express/TypeScript backend, a Next.js admin panel (operations console for kitchen staff, admins, and super admins), and a Flutter customer app, sharing one MongoDB-backed API.

**Status:** The backend and Admin Panel are feature-complete for a v1.0 release candidate (RC1) — see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full, phase-by-phase build history and every architectural decision behind it. The Flutter customer app (`apps/mobile`) is scaffolded (design tokens, routing, DI wiring) but its features are not yet implemented — it is not covered by the Admin Panel's RC1 audit.

QBite is single-tenant by design: every canteen on the platform is managed by the same admin/super_admin accounts, not by independent restaurant partners. An earlier multi-restaurant marketplace concept was explored in planning and superseded before implementation began — `docs/ARCHITECTURE.md` and `docs/DATABASE_DESIGN.md` both flag the specific sketches that no longer apply, rather than silently deleting the history.

## What's built

**Backend** (`apps/backend`) — auth (JWT + refresh rotation), canteens, menu (categories + items), orders (full lifecycle), kitchen workflow, notifications (in-app), Razorpay payments, analytics (revenue/orders/menu/canteens/users), users (admin management). See [`apps/backend/README.md`](apps/backend/README.md) for the full endpoint list and module-by-module notes.

**Admin Panel** (`apps/admin`) — one console for kitchen staff, admins, and super admins:

| Module | Route | Covers |
|---|---|---|
| Authentication | `/login`, `/forgot-password`, `/reset-password` | JWT session, silent refresh, role-gated access |
| Dashboard | `/dashboard` | Live metrics, revenue/order trend charts, recent activity |
| Orders (Operations Center) | `/orders` | Unscoped, filterable, sortable order control room |
| Kitchen | `/kitchen` | Live KDS — board/table/focus views, drag-and-drop, fullscreen TV mode |
| Users | `/users/students`, `/users/staff` | Directory, role management, activate/deactivate |
| Canteens | `/canteens` | Directory, status (open/closed), live stats |
| Menu | `/menu` | Per-canteen item directory, availability management |
| Reports & Analytics | `/reports` | Revenue/orders/menu/canteens/users, tabbed, lazy-loaded |
| Notifications | `/notifications` | The signed-in admin's own notification history |
| Payments | `/payments` | Payment ledger (built on the orders endpoint — see below), per-payment detail, analytics |

Two nav entries remain intentionally unbuilt stubs, not oversights: **Categories** (`/menu/categories` — the Menu phase scoped to items only) and **Audit Logs** (`/audit-logs` — the backend's audit module has no HTTP read surface by design, internal-only). Both show an honest "coming soon" state rather than a 404.

## Known limitations (RC1)

- **No `GET /payments` list endpoint.** The Payments page is built on the existing, unscoped `GET /kitchen/orders` (every order already carries its own real payment fields) rather than a new payments-specific endpoint — see `docs/ARCHITECTURE.md`'s Payments Management note.
- **Notifications are self-scoped, not platform-wide.** By backend design, no endpoint lets an admin read another user's notifications. The Notifications page is honestly the signed-in admin's own history, not a moderation console.
- **No report export (CSV/Excel/PDF).** No export capability exists anywhere in the backend; the Reports page's Export tab says so plainly instead of showing a non-functional button.
- **No frontend automated test suite.** `apps/admin` is verified via `tsc --noEmit`, `eslint`, and `next build` on every change; there is no Jest/Vitest/Playwright suite. The backend has one (`apps/backend`, Jest + `mongodb-memory-server`, no external DB required).
- **MongoDB Atlas connectivity has been intermittent during development.** Live, end-to-end UI verification against a real Atlas-backed backend was blocked for stretches of the build; most phases' evidence is static (typecheck/lint/build/backend-test) rather than a browser walkthrough, documented transparently in each phase's own notes.
- **`apps/mobile`** has no implemented features yet (scaffolding only).

## Documentation

Start here — this is a documentation-first project, and every structural decision below is explained in `/docs`, not just declared:

| Document | Covers |
|---|---|
| [`QBite_SRS_PRD.md`](QBite_SRS_PRD.md) | Product vision, personas, features, roadmap — the "what and why" |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System, mobile, backend, and admin architecture; auth/data flow; every phase's design decisions |
| [`docs/DATABASE_DESIGN.md`](docs/DATABASE_DESIGN.md) | MongoDB collections, relationships, indexes, naming conventions |
| [`docs/API_SPECIFICATION.md`](docs/API_SPECIFICATION.md) | REST standards, request/response envelope, error codes, versioning |
| [`docs/CODING_STANDARDS.md`](docs/CODING_STANDARDS.md) | Naming, Flutter/backend conventions, Git/commit conventions, clean code |
| [`docs/DEVELOPMENT_ROADMAP.md`](docs/DEVELOPMENT_ROADMAP.md) | Phase-by-phase plan from foundation to production release |
| [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) | Branch naming, PR rules, code review checklist, testing rules |

## Repository structure

```
qbite/
├── apps/
│   ├── mobile/       Flutter customer app (feature-first architecture; scaffolded, not yet implemented)
│   ├── backend/       Node.js + Express + TypeScript modular monolith
│   └── admin/          Next.js admin panel (kitchen staff / admin / super admin console)
├── packages/
│   ├── shared-types/    Shared TypeScript types (backend ↔ admin)
│   ├── shared-utils/     Shared framework-agnostic utilities
│   └── api-contracts/    Shared API contract source (schemas, error codes)
├── docs/                 Architecture, database, API, standards, roadmap, contributing
├── scripts/              Dev environment scripts (setup, clean, lint-all, docker-services)
├── docker/               Dockerfile placeholders (not yet wired into a working deploy)
├── .github/              Issue/PR templates, CODEOWNERS, workflows (empty — CI not added yet)
└── docker-compose.yml    Local Mongo + Redis for development
```

Why `apps/` + `packages/`, and why each app looks the way it does, is explained in [`docs/ARCHITECTURE.md` §8](docs/ARCHITECTURE.md#8-folder-structure-repository-level) — this README intentionally doesn't repeat that reasoning.

## Prerequisites

- Node.js ≥ 20, npm ≥ 10
- Flutter (latest stable), with Android/iOS toolchains as needed
- Docker (for local MongoDB/Redis via `docker-compose.yml`)

## Getting started

```bash
# From the repo root
./scripts/setup.sh
```

This installs JS/TS dependencies across `apps/backend`, `apps/admin`, and `packages/*` via npm workspaces, and resolves Flutter dependencies for `apps/mobile`. Then copy each app's `.env.example` to a real env file (see the script's output for exact paths) — never commit the real files.

Start local infrastructure:

```bash
./scripts/docker-services.sh up    # MongoDB + Redis
```

Run each app (see each app's own scripts, or the equivalent root shortcuts):

```bash
npm run backend:dev     # apps/backend  → http://localhost:4000
npm run admin:dev        # apps/admin    → http://localhost:3000
cd apps/mobile && flutter run
```

Lint everything:

```bash
./scripts/lint-all.sh
```

Run the backend test suite (no external database required — `mongodb-memory-server` spins up an in-memory instance):

```bash
cd apps/backend && npm test
```

## Tech stack

Flutter (Riverpod, GoRouter, Dio) · Node.js/Express (TypeScript) · MongoDB + Mongoose · Redis · Next.js 15 / React 19 (Tailwind, shadcn "base-nova" on `@base-ui/react`, TanStack Query/Table/Virtual, Recharts) · JWT · Razorpay · Firebase Cloud Messaging (planned, not yet wired) · Socket.IO (planned, not yet wired). Full rationale for each choice: [`docs/ARCHITECTURE.md` §11](docs/ARCHITECTURE.md) and [`QBite_SRS_PRD.md` §11](QBite_SRS_PRD.md#11-technology-stack).

## Contributing

See [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) before opening a PR — branch naming, PR rules, the code review checklist, and testing rules all live there.
