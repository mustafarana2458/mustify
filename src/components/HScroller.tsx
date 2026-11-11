import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Classes for the scrolling track (flex/grid layout of the items). */
  trackClassName?: string;
  className?: string;
  label: string;
  /**
   * 'chips': small arrows, always shown when there is overflow, scrolls 60% of the width.
   * 'shelf': larger arrows shown on hover/focus, scrolls a full page, snaps items to the start.
   */
  variant?: 'chips' | 'shelf';
}

// Edge fade widths. Spec §3.3 observed 120px for shelves; with ~180px cards that hides too
// much of a card, so I chose 48px for shelves and 24px for chip rows.
const FADE = { chips: 24, shelf: 48 };

/**
 * Horizontal scroller (UI-SPEC §3.3 / §4.1): hidden scrollbar, overscroll contained,
 * edge fade masks only on the side(s) with more content, plus chevron buttons.
 */
export function HScroller({ children, trackClassName = '', className = '', label, variant = 'chips' }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 1);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (track.current) ro.observe(track.current);
    return () => ro.disconnect();
  }, [measure]);
  // Items can change without the track resizing (filtering, data arriving).
  useEffect(measure, [children, measure]);

  const scroll = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const amount = variant === 'shelf' ? el.clientWidth : el.clientWidth * 0.6;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * amount, behavior: reduce ? 'auto' : 'smooth' });
  };

  const f = FADE[variant];
  const mask = `linear-gradient(to right, ${canLeft ? `transparent 0, #000 ${f}px` : '#000 0'}, ${
    canRight ? `#000 calc(100% - ${f}px), transparent 100%` : '#000 100%'
  })`;

  const arrowBase =
    'absolute z-10 flex items-center justify-center rounded-full bg-elevated text-fg shadow-overlay ' +
    'transition-[opacity,background-color,transform] duration-150 hover:scale-[1.04] hover:bg-elevated-hover';
  const arrow =
    variant === 'shelf'
      ? `${arrowBase} top-[calc(50%-28px)] size-8 -translate-y-1/2 opacity-0 group-hover/hs:opacity-100 focus-visible:opacity-100`
      : `${arrowBase} top-1/2 size-6 -translate-y-1/2`;

  return (
    <div className={`group/hs relative ${className}`}>
      <div
        ref={track}
        role="group"
        aria-label={label}
        onScroll={measure}
        style={{ maskImage: mask, WebkitMaskImage: mask }}
        className={
          `no-scrollbar overflow-x-auto overflow-y-hidden overscroll-x-contain ` +
          (variant === 'shelf' ? 'snap-x snap-mandatory ' : '') +
          trackClassName
        }
      >
        {children}
      </div>
      {canLeft && (
        <button type="button" aria-label={`Scroll ${label} left`} onClick={() => scroll(-1)} className={`${arrow} left-0`}>
          <ChevronLeft className={variant === 'shelf' ? 'size-5' : 'size-4'} aria-hidden />
        </button>
      )}
      {canRight && (
        <button type="button" aria-label={`Scroll ${label} right`} onClick={() => scroll(1)} className={`${arrow} right-0`}>
          <ChevronRight className={variant === 'shelf' ? 'size-5' : 'size-4'} aria-hidden />
        </button>
      )}
    </div>
  );
}
