import {
  ChevronDown,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
} from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Link } from 'react-router';
import { Artwork } from '../components/Artwork';
import { DevicePicker } from '../components/DevicePicker';
import { IconButton } from '../components/IconButton';
import { LikeButton } from '../components/LikeButton';
import { Slider } from '../components/Slider';
import { useHeaderColor } from '../lib/dominantColor';
import { formatTime } from '../lib/format';
import { cycleRepeat, next, previous, seek, setShuffle, setVolume, togglePlay } from '../player/controls';
import { selectIsLocal, usePlayer } from '../player/store';
import { usePlaybackPosition } from '../player/usePosition';
import { useAppearance } from '../store/appearance';
import { albumRoute } from './PlayerBar';

const CLOSE_DISTANCE = 120; // px dragged down to close (chosen)
const CLOSE_VELOCITY = 0.6; // px/ms flick speed that also closes (chosen)

/**
 * Full-screen Now Playing (mobile): big art, title/artists/like, seek, transport, device
 * picker and (for devices that allow it) volume. Swipe down on the header or artwork,
 * tap the chevron, or press Escape to close.
 */
export function FullScreenPlayer({ onClose }: { onClose: () => void }) {
  const accent = useAppearance((s) => s.accent);
  const item = usePlayer((s) => s.item);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const device = usePlayer((s) => s.device);
  const volume = usePlayer((s) => s.volume);
  const local = usePlayer(selectIsLocal);
  const position = usePlaybackPosition();
  const color = useHeaderColor(item?.album.images, accent);
  const [dragMs, setDragMs] = useState<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ y: number; t: number } | null>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Nothing playing any more (e.g. playback stopped on another device) → close.
  useEffect(() => {
    if (!item) onClose();
  }, [item, onClose]);
  if (!item) return null;

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, t: performance.now() };
    setDragging(true);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current) setDragY(Math.max(0, e.clientY - drag.current.y));
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const dy = Math.max(0, e.clientY - drag.current.y);
    const velocity = dy / Math.max(1, performance.now() - drag.current.t);
    drag.current = null;
    setDragging(false);
    if (dy > CLOSE_DISTANCE || velocity > CLOSE_VELOCITY) onClose();
    else setDragY(0);
  };

  const durationMs = item.durationMs;
  const shownMs = dragMs ?? position;
  const albumTo = albumRoute(item);
  const RepeatIcon = repeat === 'track' ? Repeat1 : Repeat;
  const canVolume = !local && !!device?.supports_volume;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Now playing"
      className="sheet-up fixed inset-0 z-50 flex flex-col px-6 pt-[calc(env(safe-area-inset-top)+8px)] pb-[calc(env(safe-area-inset-bottom)+20px)]"
      style={{
        background: `linear-gradient(${color} 0%, var(--color-app) 85%)`,
        transform: `translateY(${dragY}px)`,
        transition: dragging ? 'none' : 'transform 250ms var(--ease-productive)',
      }}
    >
      {/* Drag zone: header + artwork. touch-none stops the page from scrolling/bouncing. */}
      <div className="flex min-h-0 flex-1 touch-none flex-col" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <header className="flex items-center justify-between">
          <IconButton ref={closeBtn} label="Close now playing" size="touch" onClick={onClose} className="-ml-2 !text-fg">
            <ChevronDown className="size-7" aria-hidden />
          </IconButton>
          <div className="min-w-0 text-center text-xs">
            <p className="font-bold tracking-wide uppercase">Now playing</p>
            {device && <p className="truncate text-fg/80">{local ? 'This phone' : device.name}</p>}
          </div>
          <span className="size-11" aria-hidden />
        </header>
        <div className="flex min-h-0 flex-1 items-center justify-center py-6">
          <Artwork
            images={item.album.images}
            px={600}
            className="aspect-square max-h-full w-full max-w-[min(100%,calc(100dvh-440px))] min-w-40 rounded-lg shadow-[0_8px_40px_#00000080]"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          {albumTo ? (
            <Link to={albumTo} onClick={onClose} className="block truncate text-2xl font-bold">
              {item.name}
            </Link>
          ) : (
            <p className="truncate text-2xl font-bold">{item.name}</p>
          )}
          <p className="truncate text-fg/80">
            {item.artists.map((a, i) => (
              <span key={a.uri || a.name}>
                {i > 0 && ', '}
                {a.id && item.kind === 'track' ? (
                  <Link to={`/artist/${a.id}`} onClick={onClose}>
                    {a.name}
                  </Link>
                ) : (
                  a.name
                )}
              </span>
            ))}
          </p>
        </div>
        {item.kind === 'track' && <LikeButton trackId={item.id} size="touch" />}
      </div>

      <div className="mt-4">
        <Slider
          label="Seek"
          value={durationMs ? shownMs / durationMs : 0}
          disabled={durationMs === 0}
          onChange={(v) => setDragMs(v * durationMs)}
          onCommit={(v) => {
            setDragMs(null);
            void seek(v * durationMs);
          }}
          step={durationMs ? 10000 / durationMs : 0.05}
          valueText={(v) => `${formatTime(v * durationMs)} of ${formatTime(durationMs)}`}
          className="h-8"
        />
        <div className="flex justify-between text-xs text-fg/80 tabular-nums">
          <span>{formatTime(shownMs)}</span>
          <span>-{formatTime(Math.max(0, durationMs - shownMs))}</span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <IconButton label={shuffle ? 'Disable shuffle' : 'Enable shuffle'} size="touch" active={shuffle} onClick={() => void setShuffle(!shuffle)}>
          <Shuffle className="size-6" aria-hidden />
        </IconButton>
        <IconButton label="Previous" size="touch" onClick={() => void previous()} className="!text-fg">
          <SkipBack className="size-8 fill-current" aria-hidden />
        </IconButton>
        <button
          type="button"
          aria-label={isPlaying ? 'Pause' : 'Play'}
          onClick={() => void togglePlay()}
          className="flex size-16 items-center justify-center rounded-full bg-fg text-surface transition-transform duration-150 active:scale-95"
        >
          {isPlaying ? <Pause className="size-7 fill-current" aria-hidden /> : <Play className="ml-1 size-7 fill-current" aria-hidden />}
        </button>
        <IconButton label="Next" size="touch" onClick={() => void next()} className="!text-fg">
          <SkipForward className="size-8 fill-current" aria-hidden />
        </IconButton>
        <IconButton
          label={repeat === 'off' ? 'Enable repeat' : repeat === 'context' ? 'Enable repeat one' : 'Disable repeat'}
          size="touch"
          active={repeat !== 'off'}
          onClick={() => void cycleRepeat()}
        >
          <RepeatIcon className="size-6" aria-hidden />
        </IconButton>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <DevicePicker size="touch" align="start" />
        {canVolume && (
          <>
            <Volume2 className="size-4 shrink-0 text-fg/80" aria-hidden />
            <Slider
              label="Volume"
              value={volume}
              onChange={(v) => void setVolume(v, false)}
              onCommit={(v) => void setVolume(v, true)}
              valueText={(v) => `${Math.round(v * 100)}%`}
              className="h-8"
            />
          </>
        )}
      </div>
    </div>
  );
}
