'use client';

import { animate, useMotionValue, useMotionValueEvent } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  format?: (value: number) => string;
  className?: string;
  durationSeconds?: number;
}

/**
 * A reusable count-up — not dashboard-specific, so it lives in
 * `components/shared`, not `features/dashboard`. Animates via a
 * `motion` value rather than CSS so `format` (currency/compact-number/
 * plain) can run on every intermediate frame, not just the start/end.
 * Respects `prefers-reduced-motion` itself: the global CSS rule in
 * globals.css only silences CSS transitions/animations, not a JS
 * `animate()` call driving React state, so this checks
 * `matchMedia` directly and jumps straight to the final value when
 * the user has asked for reduced motion.
 */
export function AnimatedNumber({
  value,
  format = (v) => Math.round(v).toLocaleString(),
  className,
  durationSeconds = 0.8,
}: AnimatedNumberProps) {
  const motionValue = useMotionValue(0);
  const [display, setDisplay] = useState(() => format(0));
  const hasAnimatedOnceRef = useRef(false);

  useMotionValueEvent(motionValue, 'change', (latest) => {
    setDisplay(format(latest));
  });

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      motionValue.jump(value);
      return;
    }
    // A fresh mount counts up from zero at full duration (the "reveal");
    // a value that changes afterward (refetch, filter change) animates
    // faster from wherever it already is — it's an update, not an intro.
    const controls = animate(motionValue, value, {
      duration: hasAnimatedOnceRef.current ? durationSeconds * 0.6 : durationSeconds,
      ease: 'easeOut',
    });
    hasAnimatedOnceRef.current = true;
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- motionValue is a stable ref from useMotionValue; re-running on it would re-trigger the animation for no reason
  }, [value, durationSeconds]);

  return <span className={className}>{display}</span>;
}
