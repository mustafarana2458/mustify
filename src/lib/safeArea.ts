import { useSyncExternalStore } from 'react';

/*
 * Safe-area insets as numbers (px). CSS can use env(safe-area-inset-*) directly, but sticky
 * headers and scroll observers need the value in JS (e.g. the sticky bar on album pages is
 * 64px + the status-bar height).
 */

let top = 0;
let bottom = 0;
const listeners = new Set<() => void>();

function measure() {
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
  document.body.appendChild(el);
  const cs = getComputedStyle(el);
  const t = parseFloat(cs.paddingTop) || 0;
  const b = parseFloat(cs.paddingBottom) || 0;
  el.remove();
  if (t !== top || b !== bottom) {
    top = t;
    bottom = b;
    listeners.forEach((l) => l());
  }
}

export function isStandaloneDisplay(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Portrait-relative screen height (iOS doesn't swap screen.width/height on rotation). */
export function screenHeight(): number {
  const landscape = window.matchMedia('(orientation: landscape)').matches;
  return landscape ? Math.min(screen.width, screen.height) : Math.max(screen.width, screen.height);
}

/**
 * The root is sized with 100vh in standalone mode (index.css), which is the full screen once
 * the translucent status bar is active. If iOS still applies an OPAQUE status bar (the app was
 * added to the home screen before that setting existed), the viewport is shorter than 100vh
 * and the tab bar would be pushed off-screen; this flag makes the root fall back to filling
 * the viewport instead. It also shows up red in Layout diagnostics.
 */
function updateStatusBarFlag() {
  const opaque = isStandaloneDisplay() && window.innerHeight < screenHeight() - 1;
  document.documentElement.toggleAttribute('data-statusbar-opaque', opaque);
}

export function installSafeArea() {
  const update = () => {
    measure();
    updateStatusBarFlag();
  };
  update();
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', () => window.setTimeout(update, 100));
}

export function useSafeAreaTop(): number {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => top,
  );
}

export const getSafeAreaBottom = () => bottom;
