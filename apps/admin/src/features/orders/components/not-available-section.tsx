import { Info } from 'lucide-react';

interface NotAvailableSectionProps {
  reason: string;
}

/**
 * An honest "this isn't wired up" state, not an omission or a fake
 * one — used by the drawer's Notifications and Audit History
 * sections, both of which the backend genuinely has no admin-facing
 * read endpoint for yet (notifications are hard-scoped to `self`;
 * audit logs have no HTTP surface at all, internal-only — see
 * ARCHITECTURE.md §3.1's `modules/audit` note). Showing this instead
 * of silently deleting the section keeps the drawer's information
 * architecture matching the spec while being truthful about what's
 * real today.
 */
export function NotAvailableSection({ reason }: NotAvailableSectionProps) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0" />
      <p>{reason}</p>
    </div>
  );
}
