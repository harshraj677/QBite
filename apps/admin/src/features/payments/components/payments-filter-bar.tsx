'use client';

import { ArrowDown, ArrowUp, Search, X } from 'lucide-react';
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
import { PAYMENT_STATUS_LABELS } from '@/lib/order-status';
import type { PaymentsFilterState } from '../hooks/use-payments-filter-state';
import type { PaymentMethod, PaymentStatus } from '../types';

const PAYMENT_STATUSES: PaymentStatus[] = ['pending', 'paid', 'failed', 'refunded'];
const DATE_PRESETS = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7days', label: '7 Days' },
] as const;

export function PaymentsFilterBar({ filters }: { filters: PaymentsFilterState }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <InputGroup className="w-56">
        <InputGroupAddon>
          <Search className="size-4" />
        </InputGroupAddon>
        <Input
          placeholder="Order # or pickup code…"
          value={filters.search.value}
          onChange={(e) => filters.search.set(e.target.value)}
          aria-label="Search payments"
        />
      </InputGroup>

      <Select
        value={filters.paymentStatus.value ?? '__any__'}
        onValueChange={(v) =>
          filters.paymentStatus.set(v === '__any__' || !v ? undefined : (v as PaymentStatus))
        }
      >
        <SelectTrigger size="sm" className="w-40">
          <SelectValue placeholder="Any status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__any__">Any status</SelectItem>
          {PAYMENT_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {PAYMENT_STATUS_LABELS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.paymentMethod.value ?? '__any__'}
        onValueChange={(v) =>
          filters.paymentMethod.set(v === '__any__' || !v ? undefined : (v as PaymentMethod))
        }
      >
        <SelectTrigger size="sm" className="w-36">
          <SelectValue placeholder="Any method" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__any__">Any method</SelectItem>
          <SelectItem value="cash">Cash</SelectItem>
          <SelectItem value="online">Online</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
        {DATE_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => filters.datePreset.set(preset.value)}
            className={
              filters.datePreset.value === preset.value
                ? 'rounded-md bg-card px-2.5 py-1 text-xs font-medium text-foreground shadow-sm'
                : 'rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground'
            }
          >
            {preset.label}
          </button>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => filters.sortOrder.set(filters.sortOrder.value === 'desc' ? 'asc' : 'desc')}
      >
        {filters.sortOrder.value === 'desc' ? (
          <ArrowDown className="size-3.5" />
        ) : (
          <ArrowUp className="size-3.5" />
        )}
        {filters.sortOrder.value === 'desc' ? 'Newest first' : 'Oldest first'}
      </Button>

      {(filters.activeFilterCount > 0 || filters.search.value.length > 0) && (
        <Button variant="ghost" size="sm" onClick={filters.resetFilters}>
          <X className="size-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}
