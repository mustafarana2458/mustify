import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { create } from 'zustand';
import { MenuList, type MenuItem } from './Menu';

interface ContextMenuState {
  open: boolean;
  x: number;
  y: number;
  items: MenuItem[];
  /** Element to refocus on close (the row that opened it). */
  returnFocus: HTMLElement | null;
}

const useContextMenu = create<ContextMenuState>()(() => ({ open: false, x: 0, y: 0, items: [], returnFocus: null }));

/** Opens the single app-wide context menu at viewport coordinates. */
export function openContextMenu(x: number, y: number, items: MenuItem[], returnFocus: HTMLElement | null = null) {
  useContextMenu.setState({ open: true, x, y, items, returnFocus });
}

export function closeContextMenu() {
  useContextMenu.setState({ open: false });
}

const EDGE = 8; // px kept clear of the viewport edges

/**
 * Renders the context menu at the cursor (UI-SPEC §3.7), flipped/clamped to stay on screen.
 * Closes on outside click, Escape, scroll, resize, window blur and navigation.
 * Mount once (in the app shell).
 */
export function ContextMenuHost() {
  const { open, x, y, items, returnFocus } = useContextMenu();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const location = useLocation();

  useEffect(closeContextMenu, [location.pathname]);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const left = x + width > window.innerWidth - EDGE ? Math.max(EDGE, x - width) : x;
    const top = y + height > window.innerHeight - EDGE ? Math.max(EDGE, window.innerHeight - EDGE - height) : y;
    setPos({ left, top });
  }, [open, x, y, items]);

  useEffect(() => {
    if (!open) return;
    const close = () => closeContextMenu();
    const outside = (e: Event) => !ref.current?.contains(e.target as Node);
    const onDown = (e: PointerEvent) => outside(e) && close();
    const onScroll = (e: Event) => outside(e) && close(); // scrolling the menu itself is fine
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  if (!open) return null;
  return (
    <MenuList
      ref={ref}
      items={items}
      onClose={(refocus) => {
        closeContextMenu();
        if (refocus) returnFocus?.focus();
      }}
      // Absolute against #root (top-left at 0,0, like the viewport), not position:fixed.
      className="absolute"
      // Render invisibly first to measure, then place.
      style={pos ? { left: pos.left, top: pos.top } : { left: x, top: y, visibility: 'hidden' }}
    />
  );
}
