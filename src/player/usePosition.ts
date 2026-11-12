import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePlayer } from './store';

const TICK_MS = 250; // chosen: smooth enough for a 4px bar and the time labels

/**
 * Play state + interpolated position from ONE store snapshot, so the ▶/⏸ icon and the
 * moving progress bar can never disagree (the bar only advances while isPlaying is true).
 * Commands update isPlaying optimistically, so the icon flips on tap; /me/player re-syncs it.
 */
export function usePlayback(): { isPlaying: boolean; positionMs: number; durationMs: number } {
  const { positionMs, updatedAt, isPlaying, durationMs } = usePlayer(
    useShallow((s) => ({
      positionMs: s.positionMs,
      updatedAt: s.updatedAt,
      isPlaying: s.isPlaying,
      durationMs: s.item?.durationMs ?? 0,
    })),
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isPlaying) return;
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(t);
  }, [isPlaying]);

  const elapsed = isPlaying ? Math.max(0, now - updatedAt) : 0;
  return { isPlaying, positionMs: Math.max(0, Math.min(durationMs, positionMs + elapsed)), durationMs };
}

/** Current playback position in ms (see usePlayback). */
export function usePlaybackPosition(): number {
  return usePlayback().positionMs;
}
