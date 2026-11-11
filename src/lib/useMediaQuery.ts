import { useSyncExternalStore } from 'react';

/** Mobile layout breakpoint (UI-SPEC §1.7: tokens switch at 767/768px). */
export const MOBILE_QUERY = '(max-width: 767px)';
export const useIsMobileLayout = () => useMediaQuery(MOBILE_QUERY);

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
  );
}
