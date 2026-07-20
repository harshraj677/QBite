import type { UrgencyLevel } from './elapsed-time';
import type { Priority } from '../types';

const URGENCY_TO_PRIORITY: Record<UrgencyLevel, Priority> = {
  calm: 'normal',
  warning: 'attention',
  urgent: 'urgent',
  critical: 'critical',
};

export function derivePriority(urgency: UrgencyLevel): Priority {
  return URGENCY_TO_PRIORITY[urgency];
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  normal: 'On track',
  attention: 'Attention',
  urgent: 'Urgent',
  critical: 'Critical',
};

/** Tailwind classes for the timer/priority indicator — text + background pairs, all resolving to design-system tokens (success/warning/destructive), never a hardcoded color. `critical` reuses `destructive` at full strength; `urgent` is a distinct, slightly less alarming red-adjacent tone via the `warning` token at higher opacity — see globals.css's token doc comment for why `--warning` was tuned to double as a readable small-text color, which is exactly what this reuses it for. */
export const URGENCY_CLASSES: Record<
  UrgencyLevel,
  { text: string; bg: string; ring: string; dot: string }
> = {
  calm: { text: 'text-muted-foreground', bg: 'bg-muted', ring: 'ring-foreground/10', dot: 'bg-muted-foreground' },
  warning: { text: 'text-warning', bg: 'bg-warning/10', ring: 'ring-warning/30', dot: 'bg-warning' },
  urgent: { text: 'text-warning', bg: 'bg-warning/15', ring: 'ring-warning/50', dot: 'bg-warning' },
  critical: { text: 'text-destructive', bg: 'bg-destructive/10', ring: 'ring-destructive/50', dot: 'bg-destructive' },
};
