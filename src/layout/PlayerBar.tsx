import {
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  SquarePlay,
  Volume,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Fragment, useState } from 'react';
import { Link } from 'react-router';
import { Artwork } from '../components/Artwork';
import { DevicePicker } from '../components/DevicePicker';
import { IconButton } from '../components/IconButton';
import { LikeButton } from '../components/LikeButton';
import { Slider } from '../components/Slider';
import { withViewTransition } from '../lib/viewTransition';
import { cycleRepeat, next, previous, seek, setShuffle, setVolume, toggleMute, togglePlay } from '../player/controls';
import { usePlayer, type PlaybackItem } from '../player/store';
import { usePlaybackPosition } from '../player/usePosition';
import { useLayout } from '../store/layout';

export function formatTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const albumRoute = (item: PlaybackItem) =>
  item.album.id ? `/${item.kind === 'episode' ? 'show' : 'album'}/${item.album.id}` : null;

export function ArtistLinks({ item, className = '' }: { item: PlaybackItem; className?: string }) {
  return (
    <span className={`truncate ${className}`}>
      {item.artists.map((a, i) => (
        <Fragment key={a.uri || a.name}>
          {i > 0 && ', '}
          {a.id && item.kind === 'track' ? (
            <Link to={`/artist/${a.id}`} className="hover:text-fg hover:underline">
              {a.name}
            </Link>
          ) : (
            a.name
          )}
        </Fragment>
      ))}
    </span>
  );
}

/** Bottom player bar (UI-SPEC §1.6): 72px, three columns, min width 620px. */
export function PlayerBar() {
  const { rightOpen, toggleRight } = useLayout();
  const item = usePlayer((s) => s.item);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const volume = usePlayer((s) => s.volume);
  const canVolume = usePlayer((s) => !s.device || s.device.supports_volume);
  const position = usePlaybackPosition();
  // While dragging the seek bar, show the drag position instead of the live one.
  const [dragMs, setDragMs] = useState<number | null>(null);

  const idle = item === null;
  const durationMs = item?.durationMs ?? 0;
  const shownMs = dragMs ?? position;
  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.34 ? Volume : volume < 0.67 ? Volume1 : Volume2;
  const RepeatIcon = repeat === 'track' ? Repeat1 : Repeat;
  const albumTo = item ? albumRoute(item) : null;

  return (
    <footer
      aria-label="Player controls"
      className="flex h-[72px] min-w-[620px] items-center justify-between gap-2 px-2 select-none"
      style={{ gridArea: 'player' }}
    >
      {/* Left: current item */}
      <div className="flex w-[30%] min-w-[180px] items-center gap-3">
        {item && (
          <>
            {albumTo ? (
              <Link to={albumTo} aria-label={item.album.name} className="shrink-0">
                <Artwork images={item.album.images} px={56} className="size-14 rounded-sm" />
              </Link>
            ) : (
              <Artwork images={item.album.images} px={56} className="size-14 shrink-0 rounded-sm" />
            )}
            <div className="flex min-w-0 flex-col">
              {albumTo ? (
                <Link to={albumTo} className="truncate text-sm hover:underline">
                  {item.name}
                </Link>
              ) : (
                <span className="truncate text-sm">{item.name}</span>
              )}
              <ArtistLinks item={item} className="text-xs text-fg-muted" />
            </div>
            {item.kind === 'track' && <LikeButton trackId={item.id} />}
          </>
        )}
      </div>

      {/* Center: transport + progress */}
      <div className="flex w-[40%] max-w-[722px] flex-col items-center gap-1 @container">
        <div className="flex items-center gap-4">
          <IconButton
            label={shuffle ? 'Disable shuffle' : 'Enable shuffle'}
            active={idle ? undefined : shuffle}
            disabled={idle}
            onClick={() => void setShuffle(!shuffle)}
          >
            <Shuffle className="size-4" aria-hidden />
          </IconButton>
          <IconButton label="Previous" disabled={idle} onClick={() => void previous()}>
            <SkipBack className="size-4 fill-current" aria-hidden />
          </IconButton>
          <button
            type="button"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            title={isPlaying ? 'Pause' : 'Play'}
            disabled={idle}
            onClick={() => void togglePlay()}
            className="flex size-8 items-center justify-center rounded-full bg-fg text-surface transition-transform duration-150 hover:scale-[1.06] hover:duration-[50ms] active:scale-[.98] disabled:pointer-events-none disabled:opacity-30"
          >
            {isPlaying ? <Pause className="size-4 fill-current" aria-hidden /> : <Play className="ml-0.5 size-4 fill-current" aria-hidden />}
          </button>
          <IconButton label="Next" disabled={idle} onClick={() => void next()}>
            <SkipForward className="size-4 fill-current" aria-hidden />
          </IconButton>
          <IconButton
            label={repeat === 'off' ? 'Enable repeat' : repeat === 'context' ? 'Enable repeat one' : 'Disable repeat'}
            active={idle ? undefined : repeat !== 'off'}
            disabled={idle}
            onClick={() => void cycleRepeat()}
          >
            <RepeatIcon className="size-4" aria-hidden />
          </IconButton>
        </div>
        <div className="flex w-full items-center gap-2">
          {/* Spec: times use tabular numbers and hide when the container is <400px wide. */}
          <span className="hidden min-w-10 text-right text-xs text-fg-muted tabular-nums @[400px]:inline">
            {formatTime(shownMs)}
          </span>
          <Slider
            label="Seek"
            value={durationMs ? shownMs / durationMs : 0}
            disabled={idle || durationMs === 0}
            onChange={(v) => setDragMs(v * durationMs)}
            onCommit={(v) => {
              setDragMs(null);
              void seek(v * durationMs);
            }}
            step={durationMs ? 5000 / durationMs : 0.05}
            valueText={(v) => `${formatTime(v * durationMs)} of ${formatTime(durationMs)}`}
          />
          <span className="hidden min-w-10 text-xs text-fg-muted tabular-nums @[400px]:inline">
            {formatTime(durationMs)}
          </span>
        </div>
      </div>

      {/* Right: panel toggle, devices, volume */}
      <div className="flex w-[30%] min-w-[180px] items-center justify-end gap-1">
        <IconButton
          label={rightOpen ? 'Hide now playing view' : 'Show now playing view'}
          active={rightOpen}
          onClick={() => withViewTransition(toggleRight)}
        >
          <SquarePlay className="size-4" aria-hidden />
        </IconButton>
        <DevicePicker />
        {/* Spec §1.6: volume block is flex 0 125px. */}
        <div className="flex shrink-0 basis-[125px] items-center gap-1">
          <IconButton label={volume === 0 ? 'Unmute' : 'Mute'} disabled={!canVolume} onClick={() => void toggleMute()}>
            <VolumeIcon className="size-4" aria-hidden />
          </IconButton>
          <Slider
            label="Volume"
            value={volume}
            disabled={!canVolume}
            onChange={(v) => void setVolume(v, false)}
            onCommit={(v) => void setVolume(v, true)}
            step={0.1}
            valueText={(v) => `${Math.round(v * 100)}%`}
          />
        </div>
      </div>
    </footer>
  );
}
