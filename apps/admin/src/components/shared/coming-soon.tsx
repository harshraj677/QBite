import type { LucideIcon } from 'lucide-react';
import { EmptyState } from './empty-state';
import { PageHeader } from './page-header';

interface ComingSoonPageProps {
  title: string;
  pageDescription?: string;
  icon: LucideIcon;
  emptyStateDescription: string;
}

/**
 * Every not-yet-built page in the sidebar renders this rather than
 * 404ing or silently omitting the nav item — the full information
 * architecture is visible and navigable from Phase 1 on, even before
 * each page's real data view is built in a later phase. See
 * PHASE_1_REPORT.md's "Stub Pages" section for exactly which backend
 * endpoint each one is waiting on.
 */
export function ComingSoonPage({
  title,
  pageDescription,
  icon,
  emptyStateDescription,
}: ComingSoonPageProps) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={pageDescription} />
      <EmptyState
        icon={icon}
        title="Coming in a future phase"
        description={emptyStateDescription}
        className="py-24"
      />
    </div>
  );
}
