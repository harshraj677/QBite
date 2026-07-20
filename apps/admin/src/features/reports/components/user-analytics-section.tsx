'use client';

import { UserPlus, Users } from 'lucide-react';
import { StatCard } from '@/components/shared/stat-card';
import { WidgetCard } from '@/components/shared/widget-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCompactNumber, formatCurrency } from '@/lib/format';
import { useUserAnalytics } from '@/features/dashboard/hooks/use-analytics';

/**
 * The Dashboard has no dedicated User Analytics widget — `GET /analytics/users`
 * (`useUserAnalytics`, already built) has real `activeUsers`/`newUsers`/
 * `topCustomers` fields that simply weren't surfaced anywhere yet. "Top
 * Customers" is explicitly spec'd as "if supported" — it is, so it's shown,
 * not stubbed.
 */
export function UserAnalyticsSection() {
  const { data, isPending, isError, refetch } = useUserAnalytics('last30days', 10);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Active users"
          icon={Users}
          loading={isPending}
          value={data ? formatCompactNumber(data.activeUsers) : '—'}
          tooltip="Placed at least one order in the last 30 days."
        />
        <StatCard
          label="New users"
          icon={UserPlus}
          loading={isPending}
          value={data ? formatCompactNumber(data.newUsers) : '—'}
          tooltip="Registered in the last 30 days."
        />
      </div>

      <WidgetCard
        title="Top customers"
        description="Last 30 days, by total spent"
        isLoading={isPending}
        isError={isError}
        onRetry={refetch}
        isEmpty={!isPending && (data?.topCustomers.length ?? 0) === 0}
        emptyIcon={Users}
        emptyTitle="No customer activity yet"
        contentHeight="h-72"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Student</TableHead>
              <TableHead className="text-right">Orders</TableHead>
              <TableHead className="text-right">Total spent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.topCustomers ?? []).map((customer, index) => (
              <TableRow key={customer.userId}>
                <TableCell className="tabular-nums text-muted-foreground">{index + 1}</TableCell>
                <TableCell>
                  <p className="font-medium text-foreground">{customer.fullName}</p>
                  <p className="text-xs text-muted-foreground">{customer.collegeEmail}</p>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCompactNumber(customer.orderCount)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(customer.totalSpent)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </WidgetCard>
    </div>
  );
}
