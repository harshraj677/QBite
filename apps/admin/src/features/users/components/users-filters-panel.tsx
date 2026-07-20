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
import { USER_ROLE_LABELS } from '@/lib/user-role';
import type { UsersFilterState } from '../hooks/use-users-filter-state';
import type { UserRole } from '../types';

interface UsersFiltersPanelProps {
  filters: UsersFilterState;
  /** Students vs Staff pages show a different (or no) set of role options — see use-users-filter-state.ts's `lockedRole` doc comment. */
  roleOptions?: UserRole[];
  className?: string;
}

const TRI_STATE_OPTIONS = [
  { value: '__any__', label: 'Any' },
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
] as const;

export function UsersFiltersPanel({ filters, roleOptions, className }: UsersFiltersPanelProps) {
  return (
    <aside className={className} aria-label="User filters">
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
          <FieldLabel htmlFor="users-search">Search</FieldLabel>
          <InputGroup>
            <InputGroupAddon>
              <Search className="size-4" />
            </InputGroupAddon>
            <Input
              id="users-search"
              placeholder="Name, email, USN, or phone…"
              value={filters.search.value}
              onChange={(e) => filters.search.set(e.target.value)}
            />
          </InputGroup>
        </Field>

        {roleOptions && roleOptions.length > 1 && (
          <Field>
            <FieldLabel>Role</FieldLabel>
            <Select
              value={filters.role.value ?? '__any__'}
              onValueChange={(v) => filters.role.set(v === '__any__' ? undefined : (v as UserRole))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Any role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__">Any role</SelectItem>
                {roleOptions.map((role) => (
                  <SelectItem key={role} value={role}>
                    {USER_ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        <Field>
          <FieldLabel>Email verified</FieldLabel>
          <Select
            value={filters.isEmailVerified.value === undefined ? '__any__' : String(filters.isEmailVerified.value)}
            onValueChange={(v) =>
              filters.isEmailVerified.set(v === '__any__' ? undefined : v === 'true')
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              {TRI_STATE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel>Status</FieldLabel>
          <Select
            value={filters.isActive.value === undefined ? '__any__' : String(filters.isActive.value)}
            onValueChange={(v) => filters.isActive.set(v === '__any__' ? undefined : v === 'true')}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__any__">Any</SelectItem>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Deactivated</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
    </aside>
  );
}
