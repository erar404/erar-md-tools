"use client";

import { useEffect, useRef, useState } from "react";

const DURATION_MS = 450;

// Ease-out-quart — matches DESIGN.md's "no bounce, ease-out exponential
// curves" motion rule.
function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

/** Animates a displayed number toward `target` instead of snapping — used
 * for telemetry readouts (BPM) so a tempo change reads as a tick, not a
 * jump cut. Snaps instantly on first mount (nothing to animate from) and
 * whenever the visitor has `prefers-reduced-motion` set. */
export function useSpringNumber(target: number, decimals = 1): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (!mountedRef.current || prefersReducedMotion) {
      mountedRef.current = true;
      fromRef.current = target;
      setDisplay(target);
      return;
    }

    const from = fromRef.current;
    if (from === target) return;

    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / DURATION_MS);
      const eased = easeOutQuart(t);
      setDisplay(from + (target - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [target]);

  return Number(display.toFixed(decimals));
}
