import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getOrders } from '@/features/orders/api';
import type { PaymentsQueryParams } from '../types';

/** Reuses `getOrders` (the exact Operations Center call) directly — no `features/payments/api.ts` list function exists, because none is needed. */
export function usePaymentsQuery(params: PaymentsQueryParams) {
  return useQuery({
    queryKey: ['payments', 'list', params],
    queryFn: () => getOrders(params),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });
}
