import { useMemo, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import type { UrgencyLevel } from '../utils/elapsed-time';
import type { OrdersFilters, PaymentStatus } from '../types';

/** "Time" from the spec's filter list, reinterpreted honestly for a live kitchen queue: there's no meaningful "yesterday" for an active board (see the Operations Center's date presets for that use case instead) — what a line cook actually wants to filter by is urgency, the same signal the timer color already shows. `null` = any. */
export type TimeFilter = UrgencyLevel | null;

function isPickupToken(value: string): boolean {
  return /^\d{6}$/.test(value.trim());
}

export function useKitchenFilterState() {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>();
  const [studentId, setStudentId] = useState<string>();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(null);

  const debounceSearch = useDebouncedCallback((value: string) => setDebouncedSearch(value), 250);

  function updateSearch(value: string) {
    setSearchInput(value);
    debounceSearch(value);
  }

  function resetFilters() {
    setSearchInput('');
    setDebouncedSearch('');
    setPaymentStatus(undefined);
    setStudentId(undefined);
    setTimeFilter(null);
  }

  const activeFilterCount = [paymentStatus, studentId, timeFilter].filter(Boolean).length;

  // Search resolves to a real server-side orderNumber/pickupToken
  // filter (same as the Operations Center), same as paymentStatus and
  // studentId — all four are genuine `GET /kitchen/orders` query
  // params. Only `timeFilter` (urgency) is client-side, applied after
  // the fetch — there's no backend concept of "urgency," it's derived
  // entirely from real timestamps already on each order (see
  // utils/elapsed-time.ts), so there's nothing to send the server.
  const serverFilters: OrdersFilters = useMemo(
    () => ({
      paymentStatus,
      studentId,
      orderNumber:
        debouncedSearch.trim() && !isPickupToken(debouncedSearch) ? debouncedSearch.trim() : undefined,
      pickupToken:
        debouncedSearch.trim() && isPickupToken(debouncedSearch) ? debouncedSearch.trim() : undefined,
    }),
    [paymentStatus, studentId, debouncedSearch],
  );

  return {
    search: { value: searchInput, set: updateSearch },
    paymentStatus: { value: paymentStatus, set: setPaymentStatus },
    studentId: { value: studentId, set: setStudentId },
    timeFilter: { value: timeFilter, set: setTimeFilter },
    activeFilterCount,
    resetFilters,
    serverFilters,
  };
}

export type KitchenFilterState = ReturnType<typeof useKitchenFilterState>;
