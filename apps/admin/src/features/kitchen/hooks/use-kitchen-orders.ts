import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getKitchenOrders } from '../api';
import type { OrdersFilters } from '../types';

/**
 * 10s polling — faster than the Operations Center's 20s (`useOrdersQuery`)
 * on purpose: a kitchen board is a live operational surface staff are
 * looking at continuously, not a search/audit tool someone dips into.
 * `keepPreviousData` still applies — a filter change never blanks the
 * board while the new page loads.
 */
export function useKitchenOrders(filters: OrdersFilters) {
  return useQuery({
    queryKey: ['kitchen', 'orders', filters],
    queryFn: () => getKitchenOrders(filters),
    placeholderData: keepPreviousData,
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
}
