import { Check, CirclePlus } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useSavedTrack } from '../api/library';
import { Tooltip } from './Tooltip';

type Size = 'sm' | 'md' | 'lg' | 'touch';

const SIZES: Record<Size, { box: string; icon: string; dot: string; check: string }> = {
  sm: { box: 'size-8', icon: 'size-4', dot: 'size-4', check: 'size-2.5' }, // rows, player bar
  md: { box: 'size-10', icon: 'size-6', dot: 'size-6', check: 'size-3.5' }, // Now Playing panel
  lg: { box: 'size-12', icon: 'size-8', dot: 'size-8', check: 'size-5' }, // entity action row
  touch: { box: 'size-11', icon: 'size-6', dot: 'size-6', check: 'size-3.5' }, // mobile (44px target)
};

interface SaveIconButtonProps {
  saved: boolean | 'error' | undefined;
  onToggle: () => void;
  /** [label when not saved, label when saved] — used for aria-label and tooltip. */
  labels: [string, string];
  size?: Size;
  /** Unsaved state only shows on row hover/focus (track rows). Saved ✓ is always visible. */
  reveal?: boolean;
  className?: string;
}

/**
 * ⊕ when not saved, a filled accent circle with ✓ when saved (UI-SPEC §3.1 toggled state, my
 * own drawing). Shared by track likes and album/playlist saves so they look the same everywhere.
 * Renders an empty placeholder of the same size while loading or if the endpoint failed.
 */
export function SaveIconButton({ saved, onToggle, labels, size = 'sm', reveal = false, className = '' }: SaveIconButtonProps) {
  const s = SIZES[size];
  if (typeof saved !== 'boolean') return <span className={`${s.box} shrink-0 ${className}`} aria-hidden />;
  const label = saved ? labels[1] : labels[0];
  const onClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onToggle();
  };
  return (
    <Tooltip label={label} className={`shrink-0 ${className}`}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={saved}
        onClick={onClick}
        className={
          `flex ${s.box} items-center justify-center rounded-full transition-[opacity,transform,color] duration-150 ` +
          'hover:scale-[1.06] active:scale-100 ' +
          (saved
            ? ''
            : 'text-fg-muted hover:text-fg ' +
              (reveal
                ? 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 focus-visible:opacity-100 pointer-coarse:hidden'
                : ''))
        }
      >
        {saved ? (
          <span className={`flex ${s.dot} items-center justify-center rounded-full bg-accent-ink text-on-accent-ink`}>
            <Check className={s.check} strokeWidth={4} aria-hidden />
          </span>
        ) : (
          <CirclePlus className={s.icon} aria-hidden />
        )}
      </button>
    </Tooltip>
  );
}

/** Like / unlike a track (Liked Songs). State is shared app-wide, so every button stays in sync. */
export function LikeButton({
  trackId,
  size = 'sm',
  reveal,
  className,
}: {
  trackId: string | null | undefined;
  size?: Size;
  reveal?: boolean;
  className?: string;
}) {
  const [saved, toggle] = useSavedTrack(trackId);
  return (
    <SaveIconButton
      saved={trackId ? saved : 'error'}
      onToggle={toggle}
      labels={['Save to Liked Songs', 'Remove from Liked Songs']}
      size={size}
      reveal={reveal}
      className={className}
    />
  );
}
