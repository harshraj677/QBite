import { useMemo, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import type { DatePreset, OrdersFilters, OrdersQueryParams } from '../types';

const PAGE_SIZE = 50;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Mirrors apps/backend/src/modules/analytics/analytics.constants.ts's resolveDateRange exactly, for the 3 presets that have a fixed meaning — `custom` uses whatever the two date pickers hold instead. */
function resolvePresetRange(preset: DatePreset, custom: { dateFrom?: string; dateTo?: string }) {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { dateFrom: startOfDay(now).toISOString(), dateTo: endOfDay(now).toISOString() };
    case 'yesterday': {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        dateFrom: startOfDay(yesterday).toISOString(),
        dateTo: endOfDay(yesterday).toISOString(),
      };
    }
    case 'last7days': {
      const from = new Date(now);
      from.setDate(from.getDate() - 6);
      return { dateFrom: startOfDay(from).toISOString(), dateTo: endOfDay(now).toISOString() };
    }
    case 'custom':
      return {
        dateFrom: custom.dateFrom ? startOfDay(new Date(custom.dateFrom)).toISOString() : undefined,
        dateTo: custom.dateTo ? endOfDay(new Date(custom.dateTo)).toISOString() : undefined,
      };
    case 'all':
      return { dateFrom: undefined, dateTo: undefined };
  }
}

/** True if the search text is exactly a 6-digit pickup code — the two real backend search fields are `orderNumber` and `pickupToken`, and this is the only reliable way to tell which one the admin means. */
function isPickupToken(value: string): boolean {
  return /^\d{6}$/.test(value.trim());
}

/**
 * Owns every piece of Operations Center filter/sort/pagination state
 * and derives the one `OrdersQueryParams` object `useOrdersQuery`
 * actually sends — centralizing "preset -> concrete date range" and
 * "search text -> orderNumber or pickupToken" here means the Filters
 * panel and the table stay purely presentational.
 */
export function useOrdersFilterState() {
  const [status, setStatus] = useState<OrdersFilters['status']>();
  const [paymentStatus, setPaymentStatus] = useState<OrdersFilters['paymentStatus']>();
  const [studentId, setStudentId] = useState<string>();
  const [canteenId, setCanteenId] = useState<string>();
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customDateFrom, setCustomDateFrom] = useState<string>();
  const [customDateTo, setCustomDateTo] = useState<string>();
  const [minAmountRupees, setMinAmountRupees] = useState<string>('');
  const [maxAmountRupees, setMaxAmountRupees] = useState<string>('');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const debounceSearch = useDebouncedCallback((value: string) => {
    setDebouncedSearch(value);
    setPage(1);
  }, 300);

  function updateSearch(value: string) {
    setSearchInput(value);
    debounceSearch(value);
  }

  const { dateFrom, dateTo } = resolvePresetRange(datePreset, {
    dateFrom: customDateFrom,
    dateTo: customDateTo,
  });

  const activeFilterCount = [
    status,
    paymentStatus,
    studentId,
    canteenId,
    datePreset !== 'all' ? datePreset : undefined,
    minAmountRupees,
    maxAmountRupees,
  ].filter(Boolean).length;

  function resetFilters() {
    setStatus(undefined);
    setPaymentStatus(undefined);
    setStudentId(undefined);
    setCanteenId(undefined);
    setDatePreset('all');
    setCustomDateFrom(undefined);
    setCustomDateTo(undefined);
    setMinAmountRupees('');
    setMaxAmountRupees('');
    setSearchInput('');
    setDebouncedSearch('');
    setPage(1);
  }

  const queryParams: OrdersQueryParams = useMemo(() => {
    const trimmedSearch = debouncedSearch.trim();
    return {
      status,
      paymentStatus,
      studentId,
      canteenId,
      dateFrom,
      dateTo,
      minAmount: minAmountRupees ? Math.round(Number(minAmountRupees) * 100) : undefined,
      maxAmount: maxAmountRupees ? Math.round(Number(maxAmountRupees) * 100) : undefined,
      orderNumber: trimmedSearch && !isPickupToken(trimmedSearch) ? trimmedSearch : undefined,
      pickupToken: trimmedSearch && isPickupToken(trimmedSearch) ? trimmedSearch : undefined,
      page,
      limit: PAGE_SIZE,
      sortOrder,
    };
  }, [
    status,
    paymentStatus,
    studentId,
    canteenId,
    dateFrom,
    dateTo,
    minAmountRupees,
    maxAmountRupees,
    debouncedSearch,
    page,
    sortOrder,
  ]);

  function setStatusAndResetPage(value: OrdersFilters['status']) {
    setStatus(value);
    setPage(1);
  }
  function setPaymentStatusAndResetPage(value: OrdersFilters['paymentStatus']) {
    setPaymentStatus(value);
    setPage(1);
  }
  function setStudentIdAndResetPage(value: string | undefined) {
    setStudentId(value);
    setPage(1);
  }
  function setCanteenIdAndResetPage(value: string | undefined) {
    setCanteenId(value);
    setPage(1);
  }
  function setDatePresetAndResetPage(value: DatePreset) {
    setDatePreset(value);
    setPage(1);
  }

  return {
    queryParams,
    activeFilterCount,
    search: { value: searchInput, set: updateSearch },
    status: { value: status, set: setStatusAndResetPage },
    paymentStatus: { value: paymentStatus, set: setPaymentStatusAndResetPage },
    studentId: { value: studentId, set: setStudentIdAndResetPage },
    canteenId: { value: canteenId, set: setCanteenIdAndResetPage },
    datePreset: { value: datePreset, set: setDatePresetAndResetPage },
    customDateFrom: { value: customDateFrom, set: setCustomDateFrom },
    customDateTo: { value: customDateTo, set: setCustomDateTo },
    minAmount: { value: minAmountRupees, set: setMinAmountRupees },
    maxAmount: { value: maxAmountRupees, set: setMaxAmountRupees },
    sortOrder: { value: sortOrder, set: setSortOrder },
    page: { value: page, set: setPage },
    resetFilters,
  };
}

export type OrdersFilterState = ReturnType<typeof useOrdersFilterState>;
