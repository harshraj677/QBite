import { redirect } from 'next/navigation';

/**
 * `/analytics` and `/reports` were two separate Phase-1 nav entries
 * with near-identical placeholder copy ("revenue, order, menu,
 * canteen, and customer analytics" for both) — the Reports & Analytics
 * Center phase built the real page at `/reports` and left this one as
 * an untouched stub, flagged as a naming overlap to resolve later (see
 * ARCHITECTURE.md's Reports & Analytics Center note). RC1 resolves it:
 * `/analytics` is removed from the sidebar/command palette (see
 * nav-config.ts) and now redirects here, so no old bookmark or direct
 * link 404s.
 */
export default function AnalyticsPage() {
  redirect('/reports');
}
