# Contributing to QBite

This guide defines how code moves from a local branch into `main`. It assumes familiarity with [`ARCHITECTURE.md`](./ARCHITECTURE.md) and [`CODING_STANDARDS.md`](./CODING_STANDARDS.md) — read those first if you haven't.

---

## 1. Branch Naming

Follows the strategy defined in [`CODING_STANDARDS.md §6`](./CODING_STANDARDS.md#6-branch-strategy):

```
feature/<ticket-id>-<short-kebab-case-description>
bugfix/<ticket-id>-<short-kebab-case-description>
hotfix/<ticket-id>-<short-kebab-case-description>
release/<version>
```

Examples: `feature/QB-142-restaurant-search-filters`, `bugfix/QB-201-otp-retry-race-condition`, `hotfix/QB-310-webhook-signature-mismatch`.

- Ticket ID prefix is required when an issue tracker is in use — a branch without a traceable reference makes "why did this change" archaeology unnecessarily hard later.
- Branch from `develop` (feature/bugfix) or `main` (hotfix) — never branch a feature branch off another feature branch except in a deliberate, reviewed stacked-PR situation.
- Delete branches after merge — a long-lived stale branch list makes it harder to tell what's actually in progress.

---

## 2. Pull Request Rules

- **One PR, one concern.** A PR that bundles an unrelated refactor with a feature is a PR that's harder to review and harder to revert cleanly if something's wrong.
- **PR title follows Conventional Commits format** (matches [`CODING_STANDARDS.md §5`](./CODING_STANDARDS.md#5-commit-message-conventions)): `feat(orders): add cancellation state transition`.
- **PR description must state:**
  - What changed and why (link the ticket if one exists)
  - How it was tested
  - Any deliberate scope exclusions ("not handling X, tracked separately in QB-###")
- **No direct pushes to `main` or `develop`** — every change lands via a reviewed PR, no exceptions, including for the person who owns the repo. This is what makes the review checklist (§3) actually mean something.
- **CI must pass before merge:** lint, tests, build — a red pipeline blocks merge regardless of how small the change looks.
- **At least one approval required** before merge (scale this up as the team grows — a solo-maintainer period still benefits from self-review using the checklist below as a deliberate second pass, not skipping review entirely).
- **Keep PRs small enough to review in one sitting.** A PR that touches 30 files across 3 unrelated modules should almost always have been three PRs — this is a signal to split, not a hard line count.
- **Squash or rebase-merge, not merge-commit**, to keep `develop`/`main` history linear and each landed commit meaningful (consistent with the "one logical change per commit" rule in [`CODING_STANDARDS.md §4`](./CODING_STANDARDS.md#4-git-conventions)).

---

## 3. Code Review Checklist

A reviewer works through this list before approving — not as a formality, but because each item corresponds to a specific standard defined elsewhere in `/docs`:

**Correctness**
- [ ] Does the code do what the PR description claims, including edge cases (empty input, network failure, concurrent requests)?
- [ ] Are state transitions (order status, payment status) validated against the defined state machine, not just happy-path assumed?

**Architecture & Standards**
- [ ] Does the change respect module/layer boundaries per [`ARCHITECTURE.md §3.1 / §9.6`](./ARCHITECTURE.md#31-pattern-modular-monolith) (controller doesn't touch the model directly, business logic isn't in a widget, etc.)?
- [ ] Do new files follow the naming and folder conventions in [`CODING_STANDARDS.md`](./CODING_STANDARDS.md)?
- [ ] Is any new query indexed appropriately, per [`DATABASE_DESIGN.md §4`](./DATABASE_DESIGN.md#4-indexes) — has `explain()` been checked for anything touching `orders`, `restaurants`, or `menu_items`?
- [ ] Does any new/changed endpoint conform to [`API_SPECIFICATION.md`](./API_SPECIFICATION.md) (URL naming, response envelope, error codes, pagination/filtering conventions)?

**Security**
- [ ] Is all user input validated server-side, not trusted from the client (especially pricing, quantities, role claims)?
- [ ] Are new routes protected by the correct auth/RBAC middleware — is there a route that should require a role check but doesn't?
- [ ] No secrets, API keys, or credentials in the diff (double-check even innocuous-looking config files)?

**Data Integrity**
- [ ] Is anything touching payments idempotent and webhook-signature-verified, per [`ARCHITECTURE.md §6`](./ARCHITECTURE.md#6-authentication-flow)?
- [ ] Does an order-affecting change preserve the `statusHistory` audit trail?

**Testing**
- [ ] Are there tests for new business logic (service-layer / usecase-layer), not just a manual "I tried it once"?
- [ ] Do existing tests still pass, and were any tests weakened/skipped to make CI green (a red flag, not a fix)?

**Clean Code**
- [ ] Is naming meaningful without needing a comment to explain it?
- [ ] Are comments (if any) explaining *why*, not narrating *what* the code already says?
- [ ] No dead code, no leftover `console.log`/`print` debugging statements?

**Docs**
- [ ] If this change alters an architectural decision, API contract, or data model, has the relevant `/docs` file been updated in the same PR? (Docs drifting from code is treated as a bug.)

---

## 4. Testing Rules

- **New business logic requires tests before merge** — service-layer logic (backend) and usecase/provider logic (mobile), specifically. UI-only changes and pure refactors with existing coverage are judged case-by-case, not exempt by default.
- **Test naming describes behavior, not implementation:** `should reject order cancellation after PREPARING state`, not `test1` or `cancelOrderTest`.
- **No mocking the database for logic that depends on real query behavior** (e.g. geospatial queries, index-dependent sort behavior) — use a real test database instance (local/CI-provisioned MongoDB), not a mock that can silently diverge from real MongoDB semantics.
- **Payment-adjacent code is tested against realistic failure modes**, not just the success path: webhook signature mismatch, duplicate webhook delivery, payment timeout, partial refund — these are exactly the scenarios most likely to cause real financial/trust incidents if untested.
- **Critical paths (auth, checkout, payment webhook, order state transitions) require test coverage before that module is considered done** — this is a stronger bar than general code, deliberately, because these are the paths defined as non-negotiable-rigor in [`DEVELOPMENT_ROADMAP.md`](./DEVELOPMENT_ROADMAP.md) Phase 6 and Phase 10.
- **A failing test is never silenced by deleting or skipping it to unblock a merge** — fix the code or fix the test's premise; if truly out of scope, it's flagged explicitly in the PR description and tracked, not quietly disabled.

---

## 5. Folder Rules

- **New features go into the existing feature-first structure** — a new mobile feature gets its own `features/<feature_name>/{data,domain,presentation}` folder; a new backend capability gets its own `modules/<module_name>/` following the standard file suffix pattern. Do not scatter a new feature's files across existing folders by type.
- **No new top-level folders in `mobile/`, `backend/`, or `admin/` without an accompanying `ARCHITECTURE.md` update** — a new top-level folder is an architectural decision, not a local convenience, and should be visible to the whole team via the doc that's supposed to describe the system's shape.
- **Do not introduce a new cross-cutting shared package (`shared/`) speculatively** — per [`ARCHITECTURE.md §8`](./ARCHITECTURE.md#8-folder-structure-repository-level), it gets created the first time a real duplication problem exists between `backend` and `admin`, not in anticipation of one.
- **Generated/build artifacts never get committed** — if a PR diff includes `node_modules/`, `build/`, `.next/`, or similar, that's a `.gitignore` gap to fix, not content to merge.
- **Docs live in `/docs` at the repo root**, not duplicated or forked per-app — an app-specific README may point back to the relevant `/docs` file, but the canonical content lives in one place.
