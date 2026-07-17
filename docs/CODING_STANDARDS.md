# QBite — Coding Standards

**Purpose:** a new engineer should be able to predict how any file is named, where it lives, and how it's structured, without being told, by following the same rules every existing file follows. Consistency is the point — not personal preference.
**Related documents:** [`ARCHITECTURE.md`](./ARCHITECTURE.md), [`CONTRIBUTING.md`](./CONTRIBUTING.md)

---

## 1. General Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Variables, functions | `camelCase` | `calculateOrderTotal`, `isOrderCancellable` |
| Classes, types, interfaces | `PascalCase` | `OrderRepository`, `RestaurantEntity` |
| Constants (true compile-time constants) | `SCREAMING_SNAKE_CASE` | `MAX_CART_ITEMS`, `OTP_TTL_SECONDS` |
| Booleans | `is`/`has`/`should` prefix | `isLoading`, `hasError`, `shouldRetry` |
| Files | see language-specific sections below | |
| Enums / status values | lowercase string values, `PascalCase` type name | `type OrderStatus = 'placed' \| 'accepted' \| ...` |

**No abbreviations that aren't universally obvious.** `qty` and `id` are fine; `rstrntId` or `dlvryPtnr` are not. Optimize for the next reader, not for typing speed.

---

## 2. Flutter Conventions

- **File naming:** `snake_case.dart` (Dart convention), matching the primary class/widget it exports: `restaurant_card.dart` exports `RestaurantCard`.
- **Widget naming:** `PascalCase`, named for what it *is*, not what it's *for*: `RestaurantCard`, not `HomeScreenItemWidget3`.
- **One public widget per file** as a rule of thumb — private helper widgets (`_OrderStatusBadge`) may live alongside the public widget they support if they're small and not reused elsewhere.
- **Folder structure:** feature-first, per [ARCHITECTURE.md §2.1](./ARCHITECTURE.md#21-pattern-feature-first-clean-architecture) — never organize top-level folders by type (`screens/`, `widgets/`, `models/` at the app root) as the app grows, since that scatters a single feature across unrelated directories.
- **Riverpod provider naming:** suffix by role — `orderRepositoryProvider`, `activeOrderProvider` (state), `orderControllerProvider` (actions/mutations). The suffix tells the reader what kind of provider they're looking at without opening the file.
- **Immutability:** domain entities and state classes are immutable (`freezed` recommended once code generation is introduced) — state is replaced, never mutated in place. This is what makes Riverpod's change detection and the app's state predictable.
- **Null safety:** no `!` (force-unwrap) outside of cases where nullability has already been exhaustively checked immediately prior — a force-unwrap on an unchecked nullable is treated as a bug, not a shortcut.
- **Async UI states:** every screen backed by async data models all four states explicitly (loading / data / empty / error) via `AsyncValue` pattern-matching — a bare "if data is null show nothing" is not acceptable (see [ARCHITECTURE.md §2.6](./ARCHITECTURE.md#26-error--empty-state-handling)).
- **No business logic in widgets.** A widget's `build` method reads provider state and renders it; it does not compute pricing, validate input beyond basic form UX, or make network calls directly.
- **Linting:** `flutter_lints` (or a stricter superset) enforced via CI — a PR with lint warnings does not merge (see [CONTRIBUTING.md](./CONTRIBUTING.md)).

---

## 3. Backend Conventions (Node.js / Express)

- **Language:** TypeScript. Even though the original stack list specifies Node/Express generically, TypeScript is adopted project-wide for type safety across a codebase that will grow past what plain JS can safely maintain — this does not change any architectural decision already made, it's an implementation-language choice within the agreed stack.
- **File naming:** `kebab-case`, suffixed by role, matching [ARCHITECTURE.md §3.1](./ARCHITECTURE.md#31-pattern-modular-monolith): `order.controller.ts`, `order.service.ts`, `order.repository.ts`, `order.model.ts`, `order.validation.ts`.
- **Module boundary rule:** a module's `service.ts` is its only public interface to other modules. Another module may `import { OrderService }`; it may never `import { OrderModel }` directly from another module's file. This is enforced by code review, not (yet) by tooling — worth a lint rule once the module count justifies it.
- **Controllers are thin.** A controller parses the request, calls exactly one service method, and shapes the HTTP response. No business logic, no direct database access, ever, in a controller.
- **Services throw, they don't return error objects.** A service throws a typed `AppError` (with a `code` matching [API_SPECIFICATION.md §5.2](./API_SPECIFICATION.md#52-error-code-taxonomy)) on failure; the centralized error-handling middleware converts thrown errors into the standard response envelope. Controllers never manually construct error responses.
- **Async/await only.** No raw `.then()` chains, no callback-style APIs left unwrapped. Every async function that can reject is either `await`ed inside a `try/catch` or delegated to the centralized async-error-catching middleware wrapper — an unhandled promise rejection reaching the process is treated as a bug.
- **Environment config is validated at boot**, via a single typed config module — a missing required environment variable crashes startup immediately with a clear message, never surfaces later as an obscure runtime `undefined`.
- **No `console.log` in committed code.** Use the project's structured logger (with correlation-ID support per [ARCHITECTURE.md §3.2](./ARCHITECTURE.md#32-middleware-pipeline)) — `console.log` is fine as a transient local-debugging tool but must not reach a commit.
- **Database access only through the repository layer.** A service never constructs a raw Mongoose query itself; that logic lives in the module's `repository.ts` so query patterns are consistent and easy to audit for index coverage.

---

## 4. Git Conventions

- **No secrets committed, ever** — `.env` files are gitignored from the first commit; secrets live in environment-specific secret management (see [ARCHITECTURE.md §3.5](./ARCHITECTURE.md#35-configuration--environments)). If a secret is ever committed, it must be rotated immediately, not just removed from history.
- **`.gitignore` covers, at minimum:** `node_modules/`, `.env*` (except `.env.example`), build output directories (`build/`, `.next/`, `dart_tool/`), IDE-specific files, and platform build artifacts (`android/`, `ios/` generated files per Flutter's standard ignore list).
- **One logical change per commit.** A commit that mixes an unrelated formatting pass with a real behavior change makes review and future `git blame` harder than it needs to be.
- **No direct commits to `main` or `develop`** — see branch strategy (§5) and [CONTRIBUTING.md](./CONTRIBUTING.md) for enforcement.

---

## 5. Commit Message Conventions

QBite follows **[Conventional Commits](https://www.conventionalcommits.org/)**:

```
<type>(<scope>): <short summary>

[optional body]

[optional footer]
```

| Type | Use for |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only |
| `style` | Formatting, whitespace — no logic change |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or correcting tests |
| `chore` | Tooling, dependencies, build config |

**Scope** identifies the affected module/app: `feat(orders): add cancellation state transition`, `fix(auth): correct refresh-token TTL`, `docs(architecture): clarify socket room scoping`.

**Rules:**
- Summary is imperative mood ("add", not "added"/"adds"), lowercase, no trailing period, ideally under 72 characters.
- Body (when needed) explains *why*, not *what* — the diff already shows what changed.
- Breaking changes are flagged with a `BREAKING CHANGE:` footer explaining the migration impact.

---

## 6. Branch Strategy

QBite uses a **trunk-based, lightweight GitFlow variant**:

| Branch | Purpose | Rules |
|---|---|---|
| `main` | Production-released code only | Protected. Only updated via merge from `develop` (release) or `hotfix/*`. Every commit on `main` is deployable and tagged. |
| `develop` | Integration branch, next release in progress | Protected. Feature branches merge here via reviewed PR. |
| `feature/<ticket>-<short-desc>` | New feature work | Branches from `develop`, merges back to `develop`. |
| `bugfix/<ticket>-<short-desc>` | Non-urgent bug fix | Branches from `develop`, merges back to `develop`. |
| `hotfix/<ticket>-<short-desc>` | Urgent production fix | Branches from `main`, merges to **both** `main` and `develop`. |
| `release/<version>` | Release stabilization (freeze for QA before tagging) | Branches from `develop`, merges to `main` and back to `develop` on completion. |

Full naming and PR mechanics are enforced per [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## 7. File Organization

- **Max file length is a smell threshold, not a hard rule:** a file exceeding ~300-400 lines is a signal to ask whether it's doing too much, not an automatic split — don't fragment cohesive logic just to hit a line count.
- **One primary export per file**, named to match the filename (a service file exports the service it's named for, not three unrelated helpers bundled in for convenience).
- **No barrel/index files that re-export an entire module's internals** — they obscure the module boundary the architecture depends on (§3, module boundary rule) and make it easy to accidentally import something that should have stayed private. A module's intentionally-public surface is its `service.ts` (backend) or its `domain`/`presentation` exports (mobile), imported directly.
- **Tests live next to what they test** (`order.service.test.ts` beside `order.service.ts`, or in a mirrored `tests/` tree matching `src/` — pick one per app and apply it consistently; do not mix both conventions within the same codebase). **Backend decision (settled):** unit tests are colocated (`app-error.test.ts` beside `app-error.ts`); tests that spin up the full Express app via Supertest live in `src/tests/integration/` — two clearly-named categories, not an unresolved choice per module.
- **New files go where the established structure says they go** (per [ARCHITECTURE.md §2.1 and §3.1](./ARCHITECTURE.md)) — introducing a new top-level folder or a new architectural layer is a discussion for an architecture-doc update, not a one-off decision made silently inside a feature PR.

---

## 8. Clean Code Principles

- **Single Responsibility:** a function does one thing; a class/module has one reason to change. If describing what a function does requires "and," it's a candidate for splitting.
- **Small functions, shallow nesting:** prefer early returns/guard clauses over deeply nested conditionals. More than ~3 levels of nesting is a refactor signal.
- **Meaningful names over comments:** a well-named function/variable makes most comments unnecessary. Name things for what they represent, not their type (`activeOrders`, not `orderList`).
- **Comments explain *why*, never *what*.** Only write a comment when the code alone can't convey a non-obvious constraint, a workaround for a specific external-system quirk, or a subtle invariant that would surprise a future reader. If deleting the comment wouldn't confuse anyone, delete it.
- **DRY, applied judgmentally:** genuine duplicated logic (the same business rule expressed twice) gets extracted. Superficially similar code that happens to look alike today but represents different concerns is left alone — a premature shared abstraction across unrelated concerns is a worse outcome than a little repetition (see [ARCHITECTURE.md's general anti-premature-abstraction stance](./ARCHITECTURE.md#94-fail-fast-fail-loud) and the project-wide instruction to avoid speculative generalization).
- **No dead code.** Commented-out code blocks, unused functions, and feature-flagged-off-forever branches are deleted, not left "just in case" — Git history is the "just in case."
- **Fail loudly on the unexpected, silently handle the expected.** An invalid coupon code is expected user input — handle it gracefully with a clear error. A missing required config value at boot is not expected — crash immediately (see [ARCHITECTURE.md §9.4](./ARCHITECTURE.md#94-fail-fast-fail-loud)).
- **No magic numbers/strings.** `OTP_TTL_SECONDS = 300`, not a bare `300` in the middle of logic; order status values reference the shared enum, never a bare string literal typed fresh at each call site.
- **Validate at boundaries, trust internally.** Input is validated at the API/UI boundary (per [API_SPECIFICATION.md §3](./API_SPECIFICATION.md#3-request-format)); once inside the trusted layer, code isn't re-defensively re-checking things the boundary already guaranteed.
