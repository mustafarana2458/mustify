import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { pinPageToTop } from '../lib/viewportGuard';

/** New page → start at the top (the scroller itself persists across routes). */
export function useResetScrollOnNavigate(el: HTMLElement | null) {
  const location = useLocation();
  useEffect(() => {
    el?.scrollTo({ top: 0, behavior: 'instant' });
    // Also make sure the page itself isn't left offset (iOS; see lib/viewportGuard.ts).
    pinPageToTop();
  }, [location.pathname, el]);
}

/** The main panel's scrolling element (pages use it for sticky headers and infinite loading). */
export const MainScrollContext = createContext<HTMLElement | null>(null);

export const useMainScroll = () => useContext(MainScrollContext);

/**
 * True once `sentinel` has scrolled above the top of the main panel minus `offsetPx`
 * (i.e. it is now hidden under a sticky bar of that height).
 * Pass the element itself (from a callback ref + state) so late-mounting elements work.
 */
export function useScrolledPast(sentinel: Element | null, offsetPx: number): boolean {
  const root = useMainScroll();
  const [past, setPast] = useState(false);
  useEffect(() => {
    if (!sentinel || !root) return;
    const io = new IntersectionObserver(
      ([e]) => setPast(!e.isIntersecting && e.boundingClientRect.top < (e.rootBounds?.top ?? 0) + offsetPx),
      { root, rootMargin: `-${offsetPx}px 0px 0px 0px`, threshold: 0 },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [root, sentinel, offsetPx]);
  return past;
}

/** Calls `onVisible` when `sentinel` comes within `marginPx` of the bottom of the main panel. */
export function useNearBottom(sentinel: Element | null, onVisible: () => void, enabled: boolean, marginPx = 600) {
  const root = useMainScroll();
  const cb = useRef(onVisible);
  cb.current = onVisible;
  useEffect(() => {
    if (!sentinel || !root || !enabled) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && cb.current(), {
      root,
      rootMargin: `0px 0px ${marginPx}px 0px`,
    });
    io.observe(sentinel);
    return () => io.disconnect();
  }, [root, sentinel, enabled, marginPx]);
}
