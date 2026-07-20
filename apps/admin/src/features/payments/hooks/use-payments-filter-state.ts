import { useMemo, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { isPickupToken, resolvePresetRange } from '@/features/orders/hooks/use-orders-filter-state';
import type { DatePreset } from '@/features/orders/types';
import type { PaymentMethod, PaymentsQueryParams, PaymentStatus } from '../types';

const PAGE_SIZE = 50;

/**
 * Scoped to exactly the filters this phase's Payments Table asks for
 * — search, payment status, payment method, date — unlike the full
 * Operations Center filter set (order status, canteen, student,
 * amount range), which would be the wrong surface for a "Payments"
 * page to expose. Reuses `resolvePresetRange`/`isPickupToken` from
 * `useOrdersFilterState` rather than reimplementing them.
 */
export function usePaymentsFilterState() {
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>();
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customDateFrom, setCustomDateFrom] = useState<string>();
  const [customDateTo, setCustomDateTo] = useState<string>();
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
    paymentStatus,
    paymentMethod,
    datePreset !== 'all' ? datePreset : undefined,
  ].filter(Boolean).length;

  function resetFilters() {
    setPaymentStatus(undefined);
    setPaymentMethod(undefined);
    setDatePreset('all');
    setCustomDateFrom(undefined);
    setCustomDateTo(undefined);
    setSearchInput('');
    setDebouncedSearch('');
    setPage(1);
  }

  const queryParams: PaymentsQueryParams = useMemo(() => {
    const trimmedSearch = debouncedSearch.trim();
    return {
      paymentStatus,
      paymentMethod,
      dateFrom,
      dateTo,
      orderNumber: trimmedSearch && !isPickupToken(trimmedSearch) ? trimmedSearch : undefined,
      pickupToken: trimmedSearch && isPickupToken(trimmedSearch) ? trimmedSearch : undefined,
      page,
      limit: PAGE_SIZE,
      sortOrder,
    };
  }, [paymentStatus, paymentMethod, dateFrom, dateTo, debouncedSearch, page, sortOrder]);

  function setPaymentStatusAndResetPage(value: PaymentStatus | undefined) {
    setPaymentStatus(value);
    setPage(1);
  }
  function setPaymentMethodAndResetPage(value: PaymentMethod | undefined) {
    setPaymentMethod(value);
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
    paymentStatus: { value: paymentStatus, set: setPaymentStatusAndResetPage },
    paymentMethod: { value: paymentMethod, set: setPaymentMethodAndResetPage },
    datePreset: { value: datePreset, set: setDatePresetAndResetPage },
    customDateFrom: { value: customDateFrom, set: setCustomDateFrom },
    customDateTo: { value: customDateTo, set: setCustomDateTo },
    sortOrder: { value: sortOrder, set: setSortOrder },
    page: { value: page, set: setPage },
    resetFilters,
  };
}

export type PaymentsFilterState = ReturnType<typeof usePaymentsFilterState>;
