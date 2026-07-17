/**
 * Bootstrap placeholder root page.
 *
 * Replaced by the real (restaurant)/(platform-admin) route groups and
 * auth-gated redirect logic in Phase 3+ per ARCHITECTURE.md §4.1 — this
 * exists only so the app has a valid root route during the
 * engineering-foundation phase.
 */
export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-lg font-medium">QBite Admin</p>
    </div>
  );
}
