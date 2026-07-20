'use client';

import { motion } from 'motion/react';
import { Search, SlidersHorizontal, Store, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon } from '@/components/ui/input-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCanteenNameMap } from '@/features/dashboard/hooks/use-canteen-name-map';
import { ORDER_STATUS_LABELS, ORDER_STATUS_ORDER, PAYMENT_STATUS_LABELS } from '@/lib/order-status';
import type { OrdersFilterState } from '../hooks/use-orders-filter-state';
import type { PaymentStatus } from '../types';
import { StudentCombobox } from './student-combobox';

const DATE_PRESETS = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7days', label: '7 Days' },
  { value: 'custom', label: 'Custom' },
] as const;

const PAYMENT_STATUSES: PaymentStatus[] = ['pending', 'paid', 'failed', 'refunded'];

interface FiltersPanelProps {
  filters: OrdersFilterState;
  className?: string;
}

/**
 * The left panel — every control here maps 1:1 onto a real, server-
 * side `GET /kitchen/orders` query param (see the Operations Center's
 * backend extension). Nothing here filters a page already in memory;
 * changing any control triggers a real re-query.
 */
export function FiltersPanel({ filters, className }: FiltersPanelProps) {
  const { nameById } = useCanteenNameMap();
  const canteens = Array.from(nameById.entries()).sort((a, b) => a[1].localeCompare(b[1]));

  return (
    <aside className={className} aria-label="Order filters">
      <div className="flex items-center justify-between px-1 pb-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <SlidersHorizontal className="size-4" />
          Filters
          {filters.activeFilterCount > 0 && (
            <Badge variant="secondary" className="tabular-nums">
              {filters.activeFilterCount}
            </Badge>
          )}
        </h2>
        {filters.activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={filters.resetFilters}>
            <X className="size-3.5" />
            Clear
          </Button>
        )}
      </div>

      <div className="space-y-5">
        <Field>
          <FieldLabel htmlFor="orders-search">Search</FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <Search className="size-4" />
            </InputGroupAddon>
            <Input
              id="orders-search"
              placeholder="Order # or 6-digit pickup code…"
              value={filters.search.value}
              onChange={(e) => filters.search.set(e.target.value)}
            />
          </InputGroup>
        </Field>

        <Field>
          <FieldLabel>Date</FieldLabel>
          <Tabs
            value={filters.datePreset.value}
            onValueChange={(v) => filters.datePreset.set(v as OrdersFilterState['datePreset']['value'])}
          >
            <TabsList className="grid w-full grid-cols-3 gap-1 *:w-full">
              {DATE_PRESETS.slice(0, 3).map((preset) => (
                <TabsTrigger key={preset.value} value={preset.value} className="text-xs">
                  {preset.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            {DATE_PRESETS.slice(3).map((preset) => (
              <Button
                key={preset.value}
                type="button"
                variant={filters.datePreset.value === preset.value ? 'default' : 'outline'}
                size="sm"
                className="text-xs"
                onClick={() => filters.datePreset.set(preset.value)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          {filters.datePreset.value === 'custom' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-2 grid grid-cols-2 gap-1.5 overflow-hidden"
            >
              <Input
                type="date"
                aria-label="From date"
                value={filters.customDateFrom.value ?? ''}
                onChange={(e) => filters.customDateFrom.set(e.target.value || undefined)}
              />
              <Input
                type="date"
                aria-label="To date"
                value={filters.customDateTo.value ?? ''}
                onChange={(e) => filters.customDateTo.set(e.target.value || undefined)}
              />
            </motion.div>
          )}
        </Field>

        <Field>
          <FieldLabel>Status</FieldLabel>
          <Select
            value={filters.status.value ?? '__any__'}
            onValueChange={(v) =>
              filters.status.set(v === '__any__' ? undefined : (v as OrdersFilterState['status']['value']))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Any status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__any__">Any status</SelectItem>
              {ORDER_STATUS_ORDER.map((status) => (
                <SelectItem key={status} value={status}>
                  {ORDER_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>Payment status</FieldLabel>
          <Select
            value={filters.paymentStatus.value ?? '__any__'}
            onValueChange={(v) =>
              filters.paymentStatus.set(
                v === '__any__' ? undefined : (v as OrdersFilterState['paymentStatus']['value']),
              )
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Any payment status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__any__">Any payment status</SelectItem>
              {PAYMENT_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {PAYMENT_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>Canteen</FieldLabel>
          <Select
            value={filters.canteenId.value ?? '__any__'}
            onValueChange={(v) => filters.canteenId.set(v === '__any__' || !v ? undefined : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Any canteen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__any__">
                <Store className="size-3.5" />
                Any canteen
              </SelectItem>
              {canteens.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>Student</FieldLabel>
          <StudentCombobox value={filters.studentId.value} onChange={filters.studentId.set} />
        </Field>

        <Field>
          <FieldLabel>Amount (₹)</FieldLabel>
          <div className="grid grid-cols-2 gap-1.5">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              placeholder="Min"
              value={filters.minAmount.value}
              onChange={(e) => filters.minAmount.set(e.target.value)}
            />
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              placeholder="Max"
              value={filters.maxAmount.value}
              onChange={(e) => filters.maxAmount.set(e.target.value)}
            />
          </div>
        </Field>
      </div>
    </aside>
  );
}
