import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePlayer } from './store';

const TICK_MS = 250; // chosen: smooth enough for a 4px bar and the time labels

/** Current playback position in ms, interpolated locally between server/SDK updates. */
export function usePlaybackPosition(): number {
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
    const t = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(t);
  }, [isPlaying]);

  const elapsed = isPlaying ? Math.max(0, now - updatedAt) : 0;
  return Math.max(0, Math.min(durationMs, positionMs + elapsed));
}
