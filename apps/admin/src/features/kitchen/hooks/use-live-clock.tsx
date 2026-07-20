'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const LiveClockContext = createContext<Date | null>(null);

/** One shared ticking `Date`, not one `setInterval` per card — every `KitchenOrderCard` on a board of dozens re-renders off the same 15s tick instead of each running its own timer. 15s (not 1s) because these timers only ever display whole minutes (see `formatElapsed`) — ticking faster would just mean more re-renders for a number that visually never changes. */
export function LiveClockProvider({ children }: { children: ReactNode }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(interval);
  }, []);

  return <LiveClockContext.Provider value={now}>{children}</LiveClockContext.Provider>;
}

export function useLiveClock(): Date {
  const now = useContext(LiveClockContext);
  if (!now) throw new Error('useLiveClock must be used within a LiveClockProvider.');
  return now;
}
