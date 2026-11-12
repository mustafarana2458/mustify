/*
 * iOS (especially an installed home-screen app) can leave the *page itself* scrolled or offset
 * after the on-screen keyboard closes, after rotating, or when returning from another app.
 * The app is pinned to the screen with position:fixed, so a leftover page offset shows up as
 * an empty band under the tab bar. Nothing in the app is meant to scroll the page (only the
 * panels inside it scroll), so whenever the page is found offset we put it back at 0,0.
 *
 * While the keyboard is open we leave it alone (iOS scrolls to keep the field visible).
 */

function keyboardOpen(): boolean {
  const vv = window.visualViewport;
  const el = document.activeElement as HTMLElement | null;
  const typing = !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  return typing && !!vv && vv.height < window.innerHeight - 80;
}

export function pinPageToTop() {
  if (keyboardOpen()) return;
  if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0);
  const root = document.getElementById('root');
  if (root && (root.scrollTop !== 0 || root.scrollLeft !== 0)) root.scrollTo(0, 0);
}

export function installViewportGuard() {
  const later = () => window.setTimeout(pinPageToTop, 60);
  window.visualViewport?.addEventListener('resize', later);
  window.addEventListener('orientationchange', later);
  window.addEventListener('pageshow', later);
  document.addEventListener('visibilitychange', () => !document.hidden && later());
  // The keyboard closing: focus leaves a text field.
  document.addEventListener('focusout', later);
  pinPageToTop();
}
