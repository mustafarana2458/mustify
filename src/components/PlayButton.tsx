import { Pause, Play } from 'lucide-react';
import type { MouseEvent } from 'react';
import type { PlayTarget } from '../api/home';
import { play, togglePlay } from '../player/controls';
import { usePlayer, type PlayerState } from '../player/store';

/** Is this target what's currently loaded? (Same context, and same start track if one was given.) */
function isCurrent(s: PlayerState, t: PlayTarget): boolean {
  if (t.contextUri) return s.contextUri === t.contextUri && (!t.offsetUri || s.item?.uri === t.offsetUri);
  if (t.uris?.length) return s.item?.uri === t.uris[0];
  return false;
}

const SIZES = {
  sm: { box: 'size-8', icon: 'size-4' }, // quick-access tiles
  md: { box: 'size-12', icon: 'size-5' }, // cards (control-size base 48px)
  lg: { box: 'size-14', icon: 'size-6' }, // entity headers (control-size larger 56px)
};

/**
 * Accent circular play button (UI-SPEC §3.1): hover scale 1.04 and lighter accent.
 * Plays the target, or toggles pause/resume if it is already the current context.
 * Stays visible while its target is playing (parents reveal it on hover otherwise).
 */
export function PlayButton({
  target,
  label,
  size = 'md',
  className = '',
}: {
  target: PlayTarget;
  label: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const current = usePlayer((s) => isCurrent(s, target));
  const playing = usePlayer((s) => s.isPlaying) && current;

  const onClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (current) void togglePlay();
    else void play(target);
  };

  return (
    <button
      type="button"
      aria-label={playing ? `Pause ${label}` : `Play ${label}`}
      title={playing ? 'Pause' : 'Play'}
      data-playing={playing || undefined}
      onClick={onClick}
      className={
        `flex shrink-0 items-center justify-center rounded-full bg-accent text-on-accent shadow-play ` +
        `transition-[transform,background-color,opacity,translate] duration-150 ease-productive ` +
        `hover:scale-[1.04] hover:bg-accent-hover active:scale-100 active:bg-accent-press ` +
        `${SIZES[size].box} ${className}`
      }
    >
      {playing ? (
        <Pause className={`${SIZES[size].icon} fill-current`} aria-hidden />
      ) : (
        <Play className={`${SIZES[size].icon} ml-0.5 fill-current`} aria-hidden />
      )}
    </button>
  );
}
