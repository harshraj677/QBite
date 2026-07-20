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
import { NOTIFICATION_TYPE_LABELS } from '@/lib/notification-type';
import type { NotificationsFilterState } from '../hooks/use-notifications-filter-state';
import { NOTIFICATION_TYPES, type NotificationType } from '../types';

export function NotificationsFilterBar({ filters }: { filters: NotificationsFilterState }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <InputGroup className="w-64">
        <InputGroupAddon>
          <Search className="size-4" />
        </InputGroupAddon>
        <Input
          placeholder="Search title or message…"
          value={filters.search.value}
          onChange={(e) => filters.search.set(e.target.value)}
          aria-label="Search notifications"
        />
      </InputGroup>

      <Select
        value={filters.type.value ?? '__any__'}
        onValueChange={(v) =>
          filters.type.set(v === '__any__' || !v ? undefined : (v as NotificationType))
        }
      >
        <SelectTrigger size="sm" className="w-48">
          <SelectValue placeholder="Any type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__any__">Any type</SelectItem>
          {NOTIFICATION_TYPES.map((type) => (
            <SelectItem key={type} value={type}>
              {NOTIFICATION_TYPE_LABELS[type]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.isRead.value === undefined ? '__any__' : String(filters.isRead.value)}
        onValueChange={(v) => filters.isRead.set(v === '__any__' ? undefined : v === 'true')}
      >
        <SelectTrigger size="sm" className="w-36">
          <SelectValue placeholder="Any status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__any__">Any status</SelectItem>
          <SelectItem value="false">Unread</SelectItem>
          <SelectItem value="true">Read</SelectItem>
        </SelectContent>
      </Select>

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
