'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { useBoardStudentNames } from '@/features/kitchen/hooks/use-board-student-names';
import { usePaymentsFilterState } from '../hooks/use-payments-filter-state';
import { usePaymentsQuery } from '../hooks/use-payments-query';
import { PaymentDetailDrawer } from './payment-detail-drawer';
import { PaymentsAnalyticsStrip } from './payments-analytics-strip';
import { PaymentsFilterBar } from './payments-filter-bar';
import { PaymentsTable } from './payments-table';

/**
 * Built on `GET /kitchen/orders` (the same real, unscoped endpoint the
 * Operations Center uses) — there is no `GET /payments` list endpoint
 * on this backend (see ../types.ts's doc comment and
 * ARCHITECTURE.md's Payments Management note for the full reasoning).
 */
export function PaymentsPage() {
  const filterState = usePaymentsFilterState();
  const { data, isPending, isFetching, isError, refetch } = usePaymentsQuery(filterState.queryParams);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const orders = data?.data ?? [];
  const meta = data?.meta;
  const studentNameById = useBoardStudentNames(orders);
  const hasActiveFilters =
    filterState.activeFilterCount > 0 || filterState.search.value.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader
        title="Payments"
        description="Every payment across every canteen — real, derived from each order's own payment record."
      />

      <PaymentsAnalyticsStrip />

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        <PaymentsFilterBar filters={filterState} />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl ring-1 ring-foreground/10">
          <PaymentsTable
            orders={orders}
            studentNameById={studentNameById}
            isLoading={isPending}
            isFetching={isFetching}
            isError={isError}
            onRetry={refetch}
            selectedOrderId={selectedOrderId}
            onSelectOrder={setSelectedOrderId}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={filterState.resetFilters}
          />

          {meta && meta.total > 0 && (
            <div className="flex items-center justify-between border-t border-border px-3 py-2 text-sm text-muted-foreground">
              <span>
                Page {meta.page} · {meta.total} payment{meta.total === 1 ? '' : 's'} total
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={meta.page <= 1}
                  onClick={() => filterState.page.set(meta.page - 1)}
                >
                  <ChevronLeft className="size-3.5" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!meta.hasMore}
                  onClick={() => filterState.page.set(meta.page + 1)}
                >
                  Next
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <PaymentDetailDrawer orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
    </div>
  );
}
