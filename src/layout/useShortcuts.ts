import { useEffect } from 'react';
import { withViewTransition } from '../lib/viewTransition';
import { changeVolumeBy, cycleRepeat, next, previous, seekBy, setShuffle, togglePlay } from '../player/controls';
import { usePlayer } from '../player/store';
import { useLayout } from '../store/layout';
import { GLOBAL_SEARCH_ID } from '../components/SearchInput';

const SEEK_STEP_MS = 5000; // chosen
const VOLUME_STEP = 0.1; // chosen

/**
 * Global shortcuts. The spec (§4.4) only lists actions; these bindings are my own,
 * picked to avoid browser defaults ("mod" = Ctrl, or ⌘ on macOS):
 *   Ctrl+K or /        focus search
 *   Space              play / pause
 *   Ctrl+→ / Ctrl+←    next / previous
 *   Shift+→ / Shift+←  seek ±5s
 *   Ctrl+↑ / Ctrl+↓    volume ±10%
 *   Ctrl+Alt+S         shuffle
 *   Ctrl+Alt+E         repeat (off → all → one)
 *   Ctrl+Alt+L         toggle left sidebar
 *   Ctrl+Alt+R         toggle right Now Playing panel
 * (Ctrl+R/Ctrl+Shift+R reload; Alt+Shift switches keyboard layout on Windows.)
 */
export function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return; // e.g. a focused slider already handled the arrow key
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      const mod = e.ctrlKey || e.metaKey;
      // On Windows AltGr is reported as Ctrl+Alt; ignore it so typing characters like "ł" is safe.
      const altGr = e.getModifierState('AltGraph');
      const hasItem = usePlayer.getState().item !== null;

      if (mod && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        document.getElementById(GLOBAL_SEARCH_ID)?.focus();
        return;
      }
      if (typing) return;

      if (e.key === '/' && !mod && !e.altKey) {
        e.preventDefault();
        document.getElementById(GLOBAL_SEARCH_ID)?.focus();
        return;
      }

      // Space on a focused control should activate that control, not toggle playback.
      if (e.key === ' ' && !mod && !e.altKey && !e.shiftKey) {
        if (t?.closest('button, a, [role=slider], [role=separator], [role^=menuitem], summary')) return;
        if (hasItem) {
          e.preventDefault();
          void togglePlay();
        }
        return;
      }

      if (mod && !e.altKey && !e.shiftKey && hasItem) {
        if (e.key === 'ArrowRight') return e.preventDefault(), void next();
        if (e.key === 'ArrowLeft') return e.preventDefault(), void previous();
      }
      if (mod && !e.altKey && !e.shiftKey) {
        if (e.key === 'ArrowUp') return e.preventDefault(), void changeVolumeBy(VOLUME_STEP);
        if (e.key === 'ArrowDown') return e.preventDefault(), void changeVolumeBy(-VOLUME_STEP);
      }
      if (e.shiftKey && !mod && !e.altKey && hasItem) {
        if (e.key === 'ArrowRight') return e.preventDefault(), void seekBy(SEEK_STEP_MS);
        if (e.key === 'ArrowLeft') return e.preventDefault(), void seekBy(-SEEK_STEP_MS);
      }

      if (e.ctrlKey && e.altKey && !e.shiftKey && !altGr) {
        const k = e.key.toLowerCase();
        if (k === 'l') {
          e.preventDefault();
          withViewTransition(useLayout.getState().toggleLeft);
        } else if (k === 'r') {
          e.preventDefault();
          withViewTransition(useLayout.getState().toggleRight);
        } else if (k === 's' && hasItem) {
          e.preventDefault();
          void setShuffle(!usePlayer.getState().shuffle);
        } else if (k === 'e' && hasItem) {
          e.preventDefault();
          void cycleRepeat();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
