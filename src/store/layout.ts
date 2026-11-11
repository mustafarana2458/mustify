import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/*
 * Panel geometry. UI-SPEC §1.3/§1.5 and §7 list several of these as UNKNOWN (set by the
 * original app at runtime). Values marked "chosen" are my own picks.
 */
export const PANEL_GAP = 8; // chosen (spec U3: "likely 8px")
export const LEFT_COLLAPSED = 72; // chosen (spec U1: icon-only rail, unverified)
export const LEFT_MIN = 232; // spec: observed initial value of the width variable
export const LEFT_MAX = 480; // chosen
export const LEFT_DEFAULT = 300; // chosen: 232 felt cramped with filter chips
/** Dragging the sidebar narrower than this snaps it to the collapsed rail. */
export const LEFT_COLLAPSE_THRESHOLD = LEFT_MIN - 80; // chosen
export const RIGHT_MIN = 280; // chosen (spec U2)
export const RIGHT_MAX = 420; // chosen (spec U2)
export const RIGHT_DEFAULT = 320; // chosen (spec U2)
export const KEYBOARD_RESIZE_STEP = 16; // chosen

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface LayoutState {
  librarySort: 'recent' | 'alpha' | 'creator';
  setLibrarySort: (sort: 'recent' | 'alpha' | 'creator') => void;
  leftWidth: number;
  leftCollapsed: boolean;
  rightOpen: boolean;
  rightWidth: number;
  toggleLeft: () => void;
  /** Width requested by a drag/keyboard resize; may collapse or expand the rail. */
  resizeLeft: (requested: number) => void;
  toggleRight: () => void;
  setRightOpen: (open: boolean) => void;
  resizeRight: (requested: number) => void;
}

export const useLayout = create<LayoutState>()(
  persist(
    (set) => ({
      librarySort: 'recent',
      setLibrarySort: (librarySort) => set({ librarySort }),
      leftWidth: LEFT_DEFAULT,
      leftCollapsed: false,
      rightOpen: true,
      rightWidth: RIGHT_DEFAULT,
      toggleLeft: () => set((s) => ({ leftCollapsed: !s.leftCollapsed })),
      resizeLeft: (requested) =>
        set(
          requested < LEFT_COLLAPSE_THRESHOLD
            ? { leftCollapsed: true }
            : { leftCollapsed: false, leftWidth: clamp(requested, LEFT_MIN, LEFT_MAX) },
        ),
      toggleRight: () => set((s) => ({ rightOpen: !s.rightOpen })),
      setRightOpen: (rightOpen) => set({ rightOpen }),
      resizeRight: (requested) => set({ rightWidth: clamp(requested, RIGHT_MIN, RIGHT_MAX) }),
    }),
    { name: 'layout' },
  ),
);
