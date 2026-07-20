'use client';

import { FileDown } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';

/**
 * No export capability exists anywhere in this backend — no CSV/Excel/
 * PDF generation dependency, no export endpoint, in any module
 * (confirmed by searching the backend, not assumed). Per this phase's
 * own "otherwise display a clear unavailable state" instruction, this
 * is an honest empty state, not a disabled-looking fake button that
 * would suggest the feature almost works.
 */
export function ExportPanel() {
  return (
    <div className="flex h-72 items-center justify-center rounded-xl ring-1 ring-foreground/10">
      <EmptyState
        icon={FileDown}
        title="Report exports aren't available yet"
        description="CSV, Excel, and PDF export require backend support that doesn't exist in this API yet — every number on this page is real and live, but there's no export endpoint to download it from."
      />
    </div>
  );
}
