'use client';

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
import type { CanteenDto } from '@/features/canteens/types';
import type { MenuFilterState } from '../hooks/use-menu-filter-state';
import type { MenuCategoryDto } from '../types';

interface MenuFiltersPanelProps {
  filters: MenuFilterState;
  canteens: CanteenDto[];
  categories: MenuCategoryDto[];
  className?: string;
}

export function MenuFiltersPanel({ filters, canteens, categories, className }: MenuFiltersPanelProps) {
  return (
    <aside className={className} aria-label="Menu item filters">
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
          <FieldLabel>Canteen</FieldLabel>
          <Select
            value={filters.canteenId.value}
            onValueChange={(v) => filters.canteenId.set(v ?? undefined)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a canteen" />
            </SelectTrigger>
            <SelectContent>
              {canteens.map((canteen) => (
                <SelectItem key={canteen.id} value={canteen.id}>
                  <Store className="size-3.5" />
                  {canteen.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="menu-search">Search</FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <Search className="size-4" />
            </InputGroupAddon>
            <Input
              id="menu-search"
              placeholder="Item name…"
              value={filters.search.value}
              onChange={(e) => filters.search.set(e.target.value)}
            />
          </InputGroup>
        </Field>

        <Field>
          <FieldLabel>Category</FieldLabel>
          <Select
            value={filters.categoryId.value ?? '__any__'}
            onValueChange={(v) => filters.categoryId.set(v && v !== '__any__' ? v : undefined)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Any category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__any__">Any category</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>Diet</FieldLabel>
          <Select
            value={filters.isVeg.value === undefined ? '__any__' : String(filters.isVeg.value)}
            onValueChange={(v) => filters.isVeg.set(v === '__any__' ? undefined : v === 'true')}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__any__">Any</SelectItem>
              <SelectItem value="true">Veg</SelectItem>
              <SelectItem value="false">Non-veg</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>Availability</FieldLabel>
          <Select
            value={filters.isAvailable.value === undefined ? '__any__' : String(filters.isAvailable.value)}
            onValueChange={(v) => filters.isAvailable.set(v === '__any__' ? undefined : v === 'true')}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__any__">Any</SelectItem>
              <SelectItem value="true">Available</SelectItem>
              <SelectItem value="false">Unavailable</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
    </aside>
  );
}
