# QBite Admin

Next.js 15 (App Router) / React 19 operations console for QBite — the campus canteen platform's kitchen staff, admins, and super admins. See the repo root [`README.md`](../../README.md) and [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md#4-admin-dashboard-architecture-nextjs) for full context; this file only covers what's specific to running this app.

## Feature list (v1.0 RC)

| Module | Route | Roles |
|---|---|---|
| Authentication | `/login`, `/forgot-password`, `/reset-password` | all admin-panel roles |
| Dashboard | `/dashboard` | kitchen_staff/admin/super_admin (admin-only sees live metrics; kitchen_staff sees a scoped empty state) |
| Orders — Operations Center | `/orders` | admin/super_admin |
| Kitchen — live KDS | `/kitchen` | kitchen_staff/admin/super_admin |
| Users — Students/Staff directory | `/users/students`, `/users/staff` | admin/super_admin |
| Canteens directory | `/canteens` | admin/super_admin |
| Menu items directory | `/menu` | admin/super_admin |
| Reports & Analytics | `/reports` | admin/super_admin |
| Notifications | `/notifications` | all admin-panel roles (self-scoped) |
| Payments | `/payments` | admin/super_admin |

`Categories` (`/menu/categories`) and `Audit Logs` (`/audit-logs`) are real nav entries with an honest "coming soon" state, not built out yet — see the root README's Known Limitations.

## Folder structure

```
src/
  app/
    (auth)/           login, forgot-password, reset-password — unauthenticated
    (dashboard)/       every admin-panel route, behind the client-side auth gate in
                        (dashboard)/layout.tsx — one page.tsx per route, each a thin
                        Server Component (so it can export a real metadata.title) that
                        renders a Client Component from the matching features/ folder
  components/
    ui/                shadcn "base-nova" primitives, built on @base-ui/react
    shared/             cross-feature building blocks (PageHeader, WidgetCard, StatCard,
                        EmptyState, QueryErrorState, LoadingButton, ComingSoonPage, ...)
    layout/              sidebar, topbar, breadcrumbs, command palette — all derived from
                        one source of truth, components/layout/nav-config.ts
  features/<name>/
    api.ts               fetch functions — the only place `apiFetch`/`apiFetchData` are called
    types.ts               DTOs mirroring the backend's Public*Dto shapes exactly
    hooks/                TanStack Query hooks (queries + mutations) and local UI state hooks
    components/             the feature's pages and widgets
  lib/                    shared, cross-feature logic: api/client.ts (the one fetch wrapper),
                        format.ts, order-status.ts, user-role.ts, notification-type.ts,
                        chart-colors.ts, utils.ts (cn helper)
  providers/               AuthProvider, QueryClientProvider, ThemeProvider composition
  types/                   app-wide shared domain types (auth.ts's AuthUser is the
                        canonical user shape, reused — not redeclared — across features)
```

Cross-feature component/hook reuse is deliberate, not a layering violation: `NotAvailableSection`, `ConfirmActionDialog`, `OrderDetailDrawer`, `OrdersTable`, `useBoardStudentNames`, and others are imported directly across feature folders rather than duplicated — see `docs/ARCHITECTURE.md`'s per-phase notes for the specific reuse decisions.

## Getting started

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Requires `apps/backend` running (`npm run backend:dev` from the repo root) and reachable at `NEXT_PUBLIC_API_BASE_URL` (see `.env.local`, default `http://localhost:4000/api/v1`).

## Scripts

```bash
npm run dev       # next dev --turbopack
npm run build     # next build --turbopack
npm run start     # serve the production build
npm run lint      # eslint .
```

There is no `test` script — this app has no automated frontend test suite (unit, component, or e2e). Every change is verified via `tsc --noEmit`, `eslint`, and `next build`; see the root README's Known Limitations for the honest gap this leaves.

## Architecture notes

- **Client Components throughout, not Server-Components-by-default.** The refresh-token cookie is scoped to the *backend's* `/api/v1/auth` path, so a Next.js Server Component (a different origin) has no way to attach it — every data-fetching page is `'use client'`, calling `lib/api/client.ts` directly from the browser. `page.tsx` files themselves are plain Server Components purely so they can export `metadata.title`; they render a Client Component immediately, which is where all real logic lives.
- **Auth gating is client-side** (`(dashboard)/layout.tsx`), not middleware — see `docs/ARCHITECTURE.md` §4.3. The backend's own RBAC (`requireRole`) is the actual security boundary; the frontend gate is a UX nicety.
- **One design system, one navigation source of truth.** `components/layout/nav-config.ts` drives the sidebar, the command palette (Ctrl/Cmd+K), and breadcrumbs — they cannot drift apart because they render off the same data.
- **No mock data, anywhere.** Every number, chip, and chart on every page traces to a real backend response. Where a spec-requested field has no backend support, the admin panel shows an honest "Not Available" state (`NotAvailableSection`) rather than a fabricated one — this rule is enforced across every phase, not just where convenient.
