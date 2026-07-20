'use client';

import { Search, X } from 'lucide-react';
import type { RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon } from '@/components/ui/input-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StudentCombobox } from '@/features/orders/components/student-combobox';
import { PAYMENT_STATUS_LABELS } from '@/lib/order-status';
import { cn } from '@/lib/utils';
import type { KitchenFilterState } from '../hooks/use-kitchen-filter-state';
import type { TimeFilter } from '../hooks/use-kitchen-filter-state';

const TIME_OPTIONS: Array<{ value: TimeFilter; label: string }> = [
  { value: null, label: 'Any time' },
  { value: 'calm', label: 'On track' },
  { value: 'warning', label: '5m+' },
  { value: 'urgent', label: '10m+' },
  { value: 'critical', label: '15m+' },
];

const PAYMENT_STATUSES: Array<'pending' | 'paid' | 'failed' | 'refunded'> = [
  'pending',
  'paid',
  'failed',
  'refunded',
];

export function KitchenFilterBar({
  filters,
  searchInputRef,
}: {
  filters: KitchenFilterState;
  searchInputRef?: RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <InputGroup className="w-56">
        <InputGroupAddon>
          <Search className="size-4" />
        </InputGroupAddon>
        <Input
          ref={searchInputRef}
          placeholder="Order # or pickup code… (/)"
          value={filters.search.value}
          onChange={(e) => filters.search.set(e.target.value)}
          aria-label="Search kitchen queue"
        />
      </InputGroup>

      <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
        {TIME_OPTIONS.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => filters.timeFilter.set(option.value)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              filters.timeFilter.value === option.value
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <Select
        value={filters.paymentStatus.value ?? '__any__'}
        onValueChange={(v) =>
          filters.paymentStatus.set(
            v === '__any__' || !v ? undefined : (v as (typeof PAYMENT_STATUSES)[number]),
          )
        }
      >
        <SelectTrigger size="sm" className="w-40">
          <SelectValue placeholder="Any payment" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__any__">Any payment</SelectItem>
          {PAYMENT_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {PAYMENT_STATUS_LABELS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="w-56">
        <StudentCombobox value={filters.studentId.value} onChange={filters.studentId.set} />
      </div>

      {filters.activeFilterCount > 0 && (
        <Button variant="ghost" size="sm" onClick={filters.resetFilters}>
          <X className="size-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}
