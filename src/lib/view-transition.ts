import { flushSync } from "react-dom";

function canAnimate(): boolean {
  return (
    typeof document !== "undefined" &&
    "startViewTransition" in document &&
    !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/** Wraps a synchronous React state update (e.g. `setJob(done)`) in the View
 * Transitions API so the DOM swap cross-fades/morphs instead of snapping.
 * Uses `flushSync` because the View Transition API needs the DOM to already
 * reflect the new state by the time its callback returns — a plain `setState`
 * call is batched and wouldn't be painted in time otherwise. */
export function withViewTransition(update: () => void): void {
  if (!canAnimate()) {
    update();
    return;
  }
  (document as Document & { startViewTransition: (cb: () => void) => void }).startViewTransition(
    () => flushSync(update)
  );
}

/** Same idea, for a Next.js client-side route change (`router.push`), whose
 * render commit isn't synchronous the way a local `setState` is. Resolves
 * the transition on the next two animation frames — enough time for the new
 * route's content to have committed and painted in practice. */
export function withViewTransitionNav(navigate: () => void): void {
  if (!canAnimate()) {
    navigate();
    return;
  }
  (
    document as Document & { startViewTransition: (cb: () => Promise<void>) => void }
  ).startViewTransition(
    () =>
      new Promise<void>((resolve) => {
        navigate();
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })
  );
}
