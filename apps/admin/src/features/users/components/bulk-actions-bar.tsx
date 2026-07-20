'use client';

import { motion } from 'motion/react';
import { Ban, Check, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useUpdateUserStatus } from '../hooks/use-update-user-status';
import { ConfirmActionDialog } from './confirm-action-dialog';
import type { UserDto } from '../types';

interface BulkActionsBarProps {
  selectedUsers: UserDto[];
  onClear: () => void;
}

/**
 * Bulk role changes are deliberately not offered here — role is a
 * higher-consequence, one-at-a-time decision (see UsersService.updateRole's
 * legality rules) better made per-account from the drawer. Bulk
 * activate/deactivate mirrors real enterprise consoles (Auth0, Clerk)
 * that do support bulk suspend/enable — each button only acts on the
 * eligible subset of the current selection, same "partial batch, never
 * a silent no-op or an all-or-nothing failure" pattern as the Kitchen
 * board's bulk actions.
 */
export function BulkActionsBar({ selectedUsers, onClear }: BulkActionsBarProps) {
  const updateStatus = useUpdateUserStatus();
  const [confirming, setConfirming] = useState<'activate' | 'deactivate' | null>(null);

  if (selectedUsers.length === 0) return null;

  const eligibleToActivate = selectedUsers.filter((u) => !u.isActive);
  const eligibleToDeactivate = selectedUsers.filter((u) => u.isActive);

  async function runBulkStatusChange(isActive: boolean) {
    const eligible = isActive ? eligibleToActivate : eligibleToDeactivate;
    if (eligible.length === 0) return;

    const results = await Promise.allSettled(
      eligible.map((user) => updateStatus.mutateAsync({ userId: user.id, isActive })),
    );
    setConfirming(null);

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - succeeded;
    if (succeeded > 0) {
      toast.success(`${succeeded} account${succeeded === 1 ? '' : 's'} ${isActive ? 'activated' : 'deactivated'}`);
    }
    if (failed > 0) {
      toast.error(`${failed} account${failed === 1 ? '' : 's'} couldn't be updated`, {
        description: 'A guard (self-change, or last active admin) may have blocked one of these.',
      });
    }
    onClear();
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        className="flex flex-wrap items-center gap-2 rounded-xl bg-card px-3 py-2 shadow-lg ring-1 ring-foreground/10"
      >
        <span className="text-sm font-medium text-foreground">{selectedUsers.length} selected</span>
        <Separator orientation="vertical" className="h-5" />
        <Button
          variant="outline"
          size="sm"
          disabled={eligibleToActivate.length === 0 || updateStatus.isPending}
          onClick={() => setConfirming('activate')}
        >
          <Check className="size-3.5" />
          Activate
          {eligibleToActivate.length > 0 && (
            <span className="tabular-nums opacity-70">({eligibleToActivate.length})</span>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={eligibleToDeactivate.length === 0 || updateStatus.isPending}
          onClick={() => setConfirming('deactivate')}
        >
          <Ban className="size-3.5" />
          Deactivate
          {eligibleToDeactivate.length > 0 && (
            <span className="tabular-nums opacity-70">({eligibleToDeactivate.length})</span>
          )}
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="size-3.5" />
          Clear
        </Button>
      </motion.div>

      <ConfirmActionDialog
        open={confirming === 'activate'}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={`Activate ${eligibleToActivate.length} account${eligibleToActivate.length === 1 ? '' : 's'}?`}
        description="These accounts will be able to log in again immediately."
        confirmLabel="Activate"
        isPending={updateStatus.isPending}
        onConfirm={() => runBulkStatusChange(true)}
      />
      <ConfirmActionDialog
        open={confirming === 'deactivate'}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={`Deactivate ${eligibleToDeactivate.length} account${eligibleToDeactivate.length === 1 ? '' : 's'}?`}
        description="These accounts will be signed out and unable to log in until reactivated."
        confirmLabel="Deactivate"
        destructive
        isPending={updateStatus.isPending}
        onConfirm={() => runBulkStatusChange(false)}
      />
    </>
  );
}
