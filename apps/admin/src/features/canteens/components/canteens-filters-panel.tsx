'use client';

import { Search, SlidersHorizontal, X } from 'lucide-react';
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
import type { CanteensFilterState } from '../hooks/use-canteens-filter-state';

interface CanteensFiltersPanelProps {
  filters: CanteensFilterState;
  className?: string;
}

export function CanteensFiltersPanel({ filters, className }: CanteensFiltersPanelProps) {
  return (
    <aside className={className} aria-label="Canteen filters">
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
          <FieldLabel htmlFor="canteens-search">Search</FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <Search className="size-4" />
            </InputGroupAddon>
            <Input
              id="canteens-search"
              placeholder="Name or location…"
              value={filters.search.value}
              onChange={(e) => filters.search.set(e.target.value)}
            />
          </InputGroup>
        </Field>

        <Field>
          <FieldLabel>Status</FieldLabel>
          <Select
            value={filters.isOpen.value === undefined ? '__any__' : String(filters.isOpen.value)}
            onValueChange={(v) => filters.isOpen.set(v === '__any__' ? undefined : v === 'true')}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__any__">Any</SelectItem>
              <SelectItem value="true">Open</SelectItem>
              <SelectItem value="false">Closed</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
    </aside>
  );
}
