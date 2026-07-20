import { useMemo } from 'react';
import { useCanteenAnalytics } from './use-analytics';

/**
 * `OrderDto` only carries `canteenId` (see types.ts's doc comment on
 * why `GET /kitchen/orders` doesn't join canteen names in) — this
 * derives an id->name lookup from the same Canteen Analytics endpoint
 * the Revenue by Canteen chart already calls, just with a higher
 * `limit` (canteens are few; 50 covers "every canteen" in practice)
 * so the Recent Orders table can label rows without its own endpoint.
 * A second request, not a shared one with the chart's top-8 call —
 * accepted deliberately: real canteen counts are small enough that
 * this is a trivially cheap query, and keeping each widget
 * independently fetching keeps both simple and independently reusable
 * rather than prop-drilling a shared cache key between them.
 */
export function useCanteenNameMap() {
  const { data, isPending } = useCanteenAnalytics('last30days', 50);

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const canteen of data?.byCanteen ?? []) {
      map.set(canteen.canteenId, canteen.canteenName);
    }
    return map;
  }, [data]);

  return { nameById, isPending };
}
