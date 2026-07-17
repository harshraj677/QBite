# QBite Backend

Node.js/Express/TypeScript modular monolith API. See the repo root [`README.md`](../../README.md) and [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md#3-backend-architecture-nodejs--express) for full context — this file only covers what's specific to running this app.

## Structure

- `src/config/` — environment (`env.ts`, Zod-validated), MongoDB connection abstraction (`database.ts`, not yet invoked), Swagger/OpenAPI setup.
- `src/errors/` — `AppError` + one subclass per HTTP-status/error-code pairing (`docs/API_SPECIFICATION.md` §5.1).
- `src/validation/` — generic Zod-based `validateRequest(schemas)` middleware factory.
- `src/context/` — `AsyncLocalStorage`-based request context (request ID).
- `src/logging/` — the structured `pino` logger.
- `src/response/` — `sendSuccess`/`sendPaginated` response-envelope builders.
- `src/middlewares/` — request ID, request logging, security (helmet/hpp/sanitize), rate limiting, not-found, centralized error handling.
- `src/utils/` — `catchAsync` (async route wrapper), `replaceRequestProperty` (Express 5 `req.query` mutation helper).
- `src/health/` — liveness/readiness endpoint (`GET /health`, unversioned).
- `src/api/v1/` — the versioned route-mount point. Empty until the first module registers a router here.
- `src/modules/` — one folder per feature domain (`auth`, `orders`, `restaurants`, ...). Empty until each module is implemented — see `docs/ARCHITECTURE.md` §3.1 for the internal layering (`routes → controller → service → repository → model`) every module follows.

Nothing here connects to MongoDB, issues a JWT, or registers a feature route yet — this is infrastructure every future module builds on, not a feature itself.

## Common commands

```bash
npm run dev             # ts-node-dev, hot reload
npm run build             # tsc + path-alias rewrite -> dist/
npm run start               # run the built dist/server.js
npm run lint                 # eslint
npm run test                  # jest (unit + integration)
npm run test:coverage          # jest --coverage
```

## Endpoints that exist today

- `GET /health` — liveness/readiness check.
- `GET /api-docs` — Swagger UI (currently documents only `/health` — modules document themselves via `@openapi` JSDoc comments as they're built; see `config/swagger.ts`).

## Environment

Copy `.env.example` to `.env` before running — every variable has a safe development default (see `config/env.ts`), but production refuses to start with placeholder secrets.
