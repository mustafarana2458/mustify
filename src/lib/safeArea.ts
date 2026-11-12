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
 * Fallback for older iOS that sets navigator.standalone but doesn't support the
 * `(display-mode: standalone)` media query used in index.css: size the root to the screen
 * height in px (the installed app covers the whole screen). Never innerHeight.
 */
function applyStandaloneFallback() {
  const legacyStandalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true &&
    !window.matchMedia('(display-mode: standalone)').matches;
  const root = document.getElementById('root');
  if (root && legacyStandalone) root.style.height = `${screenHeight()}px`;
}

export function installSafeArea() {
  const update = () => {
    measure();
    applyStandaloneFallback();
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
