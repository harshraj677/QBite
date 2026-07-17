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
- `src/utils/` — `catchAsync` (async route wrapper), `replaceRequestProperty` (Express 5 `req.query`/`req.body` in-place mutation helper).
- `src/health/` — liveness/readiness endpoint (`GET /health`, unversioned).
- `src/api/v1/` — the versioned route-mount point.
- `src/modules/users/` — the `User` model + repository + service. Other modules depend on `UsersService`, never the repository directly.
- `src/modules/auth/` — Identity & Access Management: registration, email verification, login, refresh-token rotation, logout, password reset, RBAC (`authenticate`/`requireRole`). See `docs/ARCHITECTURE.md` §6 for the full design.
- `src/modules/` (remaining folders: `orders`, `restaurants`, ...) — empty until each is implemented, following the same internal layering (`routes → controller → service → repository → model`) as `auth`/`users`.

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
- `GET /api-docs` — Swagger UI (auth-module endpoints are documented via `@openapi` JSDoc comments on their route definitions — see `modules/auth/auth.routes.ts`).
- `POST /api/v1/auth/register`, `/verify-email`, `/login`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password`, `GET /api/v1/auth/me`.

## Environment

Copy `.env.example` to `.env` before running — every variable has a safe development default (see `config/env.ts`), but production refuses to start with placeholder secrets. Requires a running MongoDB (`docker compose up -d mongo` from the repo root, or a real `MONGO_URI`) — `server.ts` connects at bootstrap and refuses to start accepting traffic until that succeeds.
