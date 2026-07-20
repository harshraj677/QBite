import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getOrders } from '../api';
import type { OrdersQueryParams } from '../types';

/**
 * `placeholderData: keepPreviousData` is what makes filter/page/sort
 * changes feel like "the table updates," not "the table clears then
 * reloads" — the previous page's rows stay on screen (dimmed via
 * `isFetching`, see orders-table.tsx) until the new page arrives,
 * satisfying "no flashing" from the Live Experience requirements.
 * `refetchInterval` is the polling half of the same requirement — the
 * control room should never look stale for more than 20s without the
 * admin doing anything.
 */
export function useOrdersQuery(params: OrdersQueryParams) {
  return useQuery({
    queryKey: ['orders', 'list', params],
    queryFn: () => getOrders(params),
    placeholderData: keepPreviousData,
    refetchInterval: 20_000,
    staleTime: 10_000,
  });
}
