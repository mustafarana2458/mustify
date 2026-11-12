import { House, Library, Pause, Play, Search, Smartphone } from 'lucide-react';
import { useCallback, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { Artwork } from '../components/Artwork';
import { DevicePicker, NO_DEVICE_HINT } from '../components/DevicePicker';
import { IconButton } from '../components/IconButton';
import { LikeButton } from '../components/LikeButton';
import { useHeaderColor } from '../lib/dominantColor';
import { togglePlay } from '../player/controls';
import { selectIsLocal, usePlayer } from '../player/store';
import { usePlaybackPosition } from '../player/usePosition';
import { useAppearance } from '../store/appearance';
import { FullScreenPlayer } from './FullScreenPlayer';
import { MainScrollContext, useResetScrollOnNavigate } from './mainScroll';

/**
 * Mobile layout (<768px):
 *   ┌ status-bar safe area ┐
 *   │ page (scrolls)       │
 *   │ mini player / hint   │
 *   │ tab bar              │
 *   └ home-indicator area  ┘
 * Fills #root exactly (h-full; #root is pinned to the screen edges in index.css, which is
 * reliable in iOS standalone mode where 100dvh can be short). Safe areas are padded once each:
 * the top here, the bottom on the tab bar only.
 */
export function MobileLayout() {
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const [playerOpen, setPlayerOpen] = useState(false);
  const closePlayer = useCallback(() => setPlayerOpen(false), []);
  useResetScrollOnNavigate(scrollEl);

  return (
    <div className="flex h-full flex-col bg-app pt-[env(safe-area-inset-top)]">
      <main
        ref={setScrollEl}
        id="main"
        tabIndex={-1}
        className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-none bg-surface focus:outline-none"
      >
        <MainScrollContext.Provider value={scrollEl}>
          <Outlet />
        </MainScrollContext.Provider>
      </main>
      <MiniPlayer onOpen={() => setPlayerOpen(true)} />
      <TabBar />
      {playerOpen && <FullScreenPlayer onClose={closePlayer} />}
    </div>
  );
}

const TABS = [
  { to: '/', label: 'Home', icon: House, match: (p: string) => p === '/' },
  { to: '/search', label: 'Search', icon: Search, match: (p: string) => p.startsWith('/search') },
  { to: '/library', label: 'Your Library', icon: Library, match: (p: string) => p.startsWith('/library') },
];

function TabBar() {
  const { pathname } = useLocation();
  return (
    <nav aria-label="Main" className="flex shrink-0 bg-app pb-[env(safe-area-inset-bottom)]">
      {TABS.map(({ to, label, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <NavLink
            key={to}
            to={to}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] transition-colors ${active ? 'text-fg' : 'text-fg-muted'}`}
          >
            <Icon className="size-6" strokeWidth={active ? 2.6 : 2} aria-hidden />
            {label}
          </NavLink>
        );
      })}
    </nav>
  );
}

/**
 * Mini player above the tab bar: cover + title (tap → full-screen player), device, like,
 * play/pause, and a thin progress line. All targets ≥44px. In remote mode with no active
 * device, shows the "open Spotify on this phone" hint instead.
 */
function MiniPlayer({ onOpen }: { onOpen: () => void }) {
  const accent = useAppearance((s) => s.accent);
  const item = usePlayer((s) => s.item);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const mode = usePlayer((s) => s.mode);
  const device = usePlayer((s) => s.device);
  const local = usePlayer(selectIsLocal);
  const position = usePlaybackPosition();
  const color = useHeaderColor(item?.album.images, accent);

  if (!item) {
    if (mode === 'remote' && !device) {
      return (
        <div role="status" className="mx-2 mb-1 flex items-center gap-3 rounded-md bg-elevated py-1 pr-1 pl-3 text-sm">
          <Smartphone className="size-5 shrink-0 text-accent-ink" aria-hidden />
          <p className="min-w-0 flex-1 py-2 leading-snug">{NO_DEVICE_HINT}</p>
          <DevicePicker size="touch" />
        </div>
      );
    }
    return null;
  }

  const pct = item.durationMs ? (position / item.durationMs) * 100 : 0;
  return (
    // No overflow-hidden here: the device menu opens upward out of this bar.
    <div className="relative mx-2 mb-1 rounded-md shadow-overlay" style={{ backgroundColor: color }}>
      <div className="flex h-14 items-center gap-1 pr-1">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open now playing: ${item.name}`}
          className="flex h-full min-w-0 flex-1 items-center gap-3 pl-2 text-left"
        >
          <Artwork images={item.album.images} px={40} className="size-10 shrink-0 rounded-xs" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">{item.name}</span>
            <span className="block truncate text-xs text-fg/80">
              {!local && device ? `${device.name}` : item.artists.map((a) => a.name).join(', ')}
            </span>
          </span>
        </button>
        <DevicePicker size="touch" />
        {item.kind === 'track' && <LikeButton trackId={item.id} size="touch" />}
        <IconButton label={isPlaying ? 'Pause' : 'Play'} size="touch" onClick={() => void togglePlay()} className="!text-fg">
          {isPlaying ? <Pause className="size-6 fill-current" aria-hidden /> : <Play className="size-6 fill-current" aria-hidden />}
        </IconButton>
      </div>
      <div className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-fg/25" aria-hidden>
        <div className="h-full rounded-full bg-fg" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
