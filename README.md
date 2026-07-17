# QBite

QBite is a multi-restaurant food ordering & delivery marketplace: a Flutter customer app, a Node.js/Express backend, and a Next.js admin panel (restaurant partners + platform admins), sharing one MongoDB-backed API.

**Status:** Engineering foundation phase. No business logic, UI screens, APIs, or authentication have been implemented yet — this repository currently contains planning documentation and a scaffolded, verified-buildable project structure only. See [`docs/DEVELOPMENT_ROADMAP.md`](docs/DEVELOPMENT_ROADMAP.md) for what's next.

## Documentation

Start here — this is a documentation-first project, and every structural decision below is explained in `/docs`, not just declared:

| Document | Covers |
|---|---|
| [`QBite_SRS_PRD.md`](QBite_SRS_PRD.md) | Product vision, personas, features, roadmap — the "what and why" |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System, mobile, backend, and admin architecture; auth/data flow; design principles |
| [`docs/DATABASE_DESIGN.md`](docs/DATABASE_DESIGN.md) | MongoDB collections, relationships, indexes, naming conventions |
| [`docs/API_SPECIFICATION.md`](docs/API_SPECIFICATION.md) | REST standards, request/response envelope, error codes, versioning |
| [`docs/CODING_STANDARDS.md`](docs/CODING_STANDARDS.md) | Naming, Flutter/backend conventions, Git/commit conventions, clean code |
| [`docs/DEVELOPMENT_ROADMAP.md`](docs/DEVELOPMENT_ROADMAP.md) | Phase-by-phase plan from foundation to production release |
| [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) | Branch naming, PR rules, code review checklist, testing rules |

## Repository structure

```
qbite/
├── apps/
│   ├── mobile/       Flutter customer app (feature-first architecture)
│   ├── backend/       Node.js + Express + TypeScript modular monolith
│   └── admin/          Next.js admin panel (restaurant + platform admin)
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

## Tech stack

Flutter (Riverpod, GoRouter, Dio) · Node.js/Express (TypeScript) · MongoDB + Mongoose · Redis · Next.js (Tailwind, shadcn/ui) · JWT · Razorpay · Firebase Cloud Messaging · Socket.IO. Full rationale for each choice: [`docs/ARCHITECTURE.md` §11](docs/ARCHITECTURE.md) and [`QBite_SRS_PRD.md` §11](QBite_SRS_PRD.md#11-technology-stack).

## Contributing

See [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) before opening a PR — branch naming, PR rules, the code review checklist, and testing rules all live there.
