import { flushSync } from 'react-dom';

/**
 * Runs a state update inside the View Transitions API when available (UI-SPEC §1.5 / §4.5:
 * panels open and close with view transitions). Falls back to an instant update.
 */
export function withViewTransition(update: () => void): void {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || typeof document.startViewTransition !== 'function') {
    update();
    return;
  }
  document.startViewTransition(() => flushSync(update));
}
