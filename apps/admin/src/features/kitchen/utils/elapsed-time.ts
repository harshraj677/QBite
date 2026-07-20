import type { OrderStatus, OrderWithItemsDto } from '../types';

export type UrgencyLevel = 'calm' | 'warning' | 'urgent' | 'critical';

/** Minutes-in-current-stage thresholds — real defaults for a campus canteen's fast-food-scale prep times, not arbitrary. Kept as one place so re-tuning for a different kitchen's pace is a one-line change. */
export const URGENCY_THRESHOLDS_MINUTES: Record<Exclude<UrgencyLevel, 'calm'>, number> = {
  warning: 5,
  urgent: 10,
  critical: 15,
};

const STAGE_TIMESTAMP_FIELD: Record<OrderStatus, keyof OrderWithItemsDto | null> = {
  pending: 'createdAt',
  accepted: 'acceptedAt',
  preparing: 'preparingAt',
  ready: 'readyAt',
  completed: 'completedAt',
  cancelled: 'cancelledAt',
};

/**
 * "How long has this ticket been sitting at its *current* stage" —
 * the standard KDS timer semantic (not "how long since it was
 * placed"), computed from the real timestamp the backend stamps when
 * an order enters that stage. Returns `null` only if the expected
 * timestamp is somehow missing (shouldn't happen for a well-formed
 * order, but this is real data from the network, not a fixture).
 */
export function getStageStartedAt(order: OrderWithItemsDto): Date | null {
  const field = STAGE_TIMESTAMP_FIELD[order.status];
  const value = field ? order[field] : undefined;
  return typeof value === 'string' ? new Date(value) : null;
}

export function getElapsedMinutes(order: OrderWithItemsDto, now: Date): number {
  const startedAt = getStageStartedAt(order);
  if (!startedAt) return 0;
  return Math.max(0, (now.getTime() - startedAt.getTime()) / 60_000);
}

export function getUrgencyLevel(elapsedMinutes: number): UrgencyLevel {
  if (elapsedMinutes >= URGENCY_THRESHOLDS_MINUTES.critical) return 'critical';
  if (elapsedMinutes >= URGENCY_THRESHOLDS_MINUTES.urgent) return 'urgent';
  if (elapsedMinutes >= URGENCY_THRESHOLDS_MINUTES.warning) return 'warning';
  return 'calm';
}

/** `12m` / `1h 04m` — never raw decimal minutes, never seconds (a KDS card doesn't need second-level precision, and showing it would just make the number visibly tick during a glance, which reads as "broken," not "live"). */
export function formatElapsed(elapsedMinutes: number): string {
  const totalMinutes = Math.floor(elapsedMinutes);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}
