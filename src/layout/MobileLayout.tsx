import { Download, ExternalLink, House, Library, Loader2, Pause, Play, Search, Smartphone } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { Artwork } from '../components/Artwork';
import { OfflineBadge, OfflineGate } from '../components/OfflineGate';
import { DevicePicker, NO_DEVICE_HINT } from '../components/DevicePicker';
import { IconButton } from '../components/IconButton';
import { LikeButton } from '../components/LikeButton';
import { useHeaderColor } from '../lib/dominantColor';
import { togglePlay } from '../player/controls';
import { getLastDevice } from '../player/lastDevice';
import { selectIsLocal, usePlayer } from '../player/store';
import { usePlayback } from '../player/usePosition';
import { useAppearance } from '../store/appearance';
import { FullScreenPlayer } from './FullScreenPlayer';
import { MainScrollContext, useResetScrollOnNavigate } from './mainScroll';
import { useStatusBarColor } from './statusBar';

/*
 * Mobile layout (<768px), modelled on the iPhone app:
 *
 *   ┌───────────────────────────┐ ← screen top (behind the clock: page background; a solid
 *   │ status-bar backdrop       │   backdrop fades in once you scroll)
 *   │                           │
 *   │ page content (scrolls the │
 *   │ full height, behind the   │
 *   │ overlays below)           │
 *   │  ┌─────────────────────┐  │ ← mini player: floats 8px above the tab bar, 8px sides
 *   │  └─────────────────────┘  │
 *   │ tab bar (gradient)        │ ← pinned to the bottom: 56px + safe-area-inset-bottom
 *   └───────────────────────────┘ ← screen bottom (home indicator)
 *
 * The tab bar and mini player are position:fixed to the bottom of the visible area; the layout
 * box is anchored to the same edges, so they always line up. The ONLY bottom spacing is
 * env(safe-area-inset-bottom) inside the tab bar; the scroller ends with a spacer as tall as
 * the overlays so the last row isn't hidden.
 */

const TAB_BAR_H = 56; // px, plus the bottom safe area
const FLOAT_GAP = 8; // px between mini player and tab bar / screen sides
const TAB_BAR_HEIGHT_CSS = `calc(${TAB_BAR_H}px + env(safe-area-inset-bottom))`;

export function MobileLayout() {
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [floatH, setFloatH] = useState(0);
  const closePlayer = useCallback(() => setPlayerOpen(false), []);
  useResetScrollOnNavigate(scrollEl);
  const statusColor = useStatusBarColor((s) => s.color);
  const location = useLocation();

  // Status-bar backdrop: transparent at the top of a page (header shows through), solid once
  // you scroll so content never shows under the clock.
  useEffect(() => {
    if (!scrollEl) return;
    const onScroll = () => setScrolled(scrollEl.scrollTop > 2);
    onScroll();
    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    return () => scrollEl.removeEventListener('scroll', onScroll);
  }, [scrollEl, location.pathname]);

  return (
    // Anchored (fixed, top 0 / bottom 0) to the same box as the fixed tab bar below, so the
    // scrolling page ends exactly where the tab bar does and nothing hides under or below it.
    <div className="fixed inset-x-0 top-0 bottom-0 overflow-hidden bg-surface">
      <main
        ref={setScrollEl}
        id="main"
        tabIndex={-1}
        className="h-full overflow-x-hidden overflow-y-auto overscroll-none bg-surface focus:outline-none"
      >
        <MainScrollContext.Provider value={scrollEl}>
          <OfflineGate>
            <Outlet />
          </OfflineGate>
        </MainScrollContext.Provider>
        {/* Room for the overlays (tab bar + floating mini player) so the last row is reachable. */}
        <div
          aria-hidden
          style={{ height: `calc(${TAB_BAR_H}px + env(safe-area-inset-bottom) + ${floatH ? floatH + FLOAT_GAP * 2 : 0}px)` }}
        />
      </main>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-30 transition-opacity duration-200"
        style={{
          height: 'env(safe-area-inset-top)',
          backgroundColor: statusColor ?? 'var(--color-surface)',
          opacity: scrolled ? 1 : 0,
        }}
      />

      {/* "Offline" pill just under the status bar when there's no internet. */}
      <div className="pointer-events-none absolute top-[calc(env(safe-area-inset-top)+8px)] right-3 z-40">
        <OfflineBadge />
      </div>

      <FloatingPlayer onOpen={() => setPlayerOpen(true)} onHeight={setFloatH} />
      <TabBar />
      {playerOpen && <FullScreenPlayer onClose={closePlayer} />}
    </div>
  );
}

const TABS = [
  { to: '/', label: 'Home', icon: House, match: (p: string) => p === '/' },
  { to: '/search', label: 'Search', icon: Search, match: (p: string) => p.startsWith('/search') },
  { to: '/library', label: 'Your Library', icon: Library, match: (p: string) => p.startsWith('/library') },
  { to: '/offline', label: 'Offline', icon: Download, match: (p: string) => p.startsWith('/offline') },
];

/**
 * Pinned to the very bottom, overlaying the content. 56px + the home-indicator safe area (the
 * only bottom spacing in the layout). Vertical gradient: transparent at the top → solid page
 * background at the bottom. Icons 24px, labels 11px; active tab in the text colour and bold.
 */
function TabBar() {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Main"
      className="fixed right-0 bottom-0 left-0 z-30 flex items-start bg-surface pb-[env(safe-area-inset-bottom)]"
      style={{ height: TAB_BAR_HEIGHT_CSS }}
    >
      {/* Fade from transparent to the page background, directly above the bar (40% of the
          bar's height), so icons and labels always sit on solid colour. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-full"
        style={{
          height: `calc((${TAB_BAR_H}px + env(safe-area-inset-bottom)) * 0.4)`,
          background: 'linear-gradient(to bottom, transparent, var(--color-surface))',
        }}
      />
      {TABS.map(({ to, label, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <NavLink
            key={to}
            to={to}
            aria-current={active ? 'page' : undefined}
            className={`flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 transition-colors ${active ? 'text-fg' : 'text-fg-muted'}`}
          >
            <Icon className="size-6 shrink-0" strokeWidth={active ? 2.6 : 2} aria-hidden />
            <span className={`block max-w-full truncate px-1 text-[11px] leading-[13px] ${active ? 'font-bold' : ''}`}>{label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

/**
 * Floats 8px above the tab bar with 8px side margins. Shows the mini player, or (remote mode,
 * nothing active) the device hint. Reports its height so the scroller can leave room for it.
 */
function FloatingPlayer({ onOpen, onHeight }: { onOpen: () => void; onHeight: (h: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const item = usePlayer((s) => s.item);
  const mode = usePlayer((s) => s.mode);
  const device = usePlayer((s) => s.device);
  const content = item ? <MiniPlayer onOpen={onOpen} /> : mode === 'remote' && !device ? <DeviceHint /> : null;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => onHeight(content ? el.offsetHeight : 0));
    ro.observe(el);
    onHeight(content ? el.offsetHeight : 0);
    return () => ro.disconnect();
    // Re-attach when the card appears/disappears; size changes are caught by the observer.
  }, [content !== null, onHeight]);

  return (
    <div
      ref={ref}
      className="fixed z-30"
      style={{
        left: FLOAT_GAP,
        right: FLOAT_GAP,
        bottom: `calc(${TAB_BAR_HEIGHT_CSS} + ${FLOAT_GAP}px)`,
      }}
    >
      {content}
    </div>
  );
}

/**
 * Dark "island" styles: the mini player always uses white text on a darkened album colour,
 * whatever the app theme, so theme text colours are overridden locally.
 */
const ON_DARK: CSSProperties = {
  ['--color-fg' as string]: '#FFFFFF',
  ['--color-fg-muted' as string]: '#C8C8C8',
  // Accent-coloured ✓ on a dark card: the raw accent reads well; theme "ink" may be darkened.
  ['--color-accent-ink' as string]: 'var(--color-accent)',
  ['--color-on-accent-ink' as string]: 'var(--color-on-accent)',
};

function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="relative rounded-lg text-fg shadow-overlay" style={{ ...ON_DARK, ...style }}>
      {children}
    </div>
  );
}

/**
 * Mini player: 40px cover, title + artists (ellipsis), device, like (⊕ / filled ✓) and
 * play/pause, all ≥44px targets. Background = the album colour darkened for white text, with
 * a smooth transition. Thin progress line on the bottom edge, inset 8px.
 */
function MiniPlayer({ onOpen }: { onOpen: () => void }) {
  const accent = useAppearance((s) => s.accent);
  const item = usePlayer((s) => s.item);
  const device = usePlayer((s) => s.device);
  const local = usePlayer(selectIsLocal);
  const engine = usePlayer((s) => s.engine);
  // Icon and progress from the same snapshot, so they always agree.
  const { isPlaying, positionMs } = usePlayback();
  const color = useHeaderColor(item?.album.images, accent, { forWhiteText: true });
  if (!item) return null;
  const pct = item.durationMs ? (positionMs / item.durationMs) * 100 : 0;

  return (
    // No overflow-hidden: the device menu opens upward out of this card.
    <Card style={{ backgroundColor: color, transition: 'background-color 500ms var(--ease-productive)' }}>
      <div className="flex h-14 items-center gap-1 pr-1">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open now playing: ${item.name}`}
          className="flex h-full min-w-0 flex-1 items-center gap-2.5 pl-2 text-left"
        >
          <Artwork images={item.album.images} px={40} className="size-10 shrink-0 rounded-sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">{item.name}</span>
            <span className="block truncate text-xs text-fg-muted">
              {engine === 'spotify' && !local && device ? device.name : item.artists.map((a) => a.name).join(', ')}
            </span>
          </span>
        </button>
        <DevicePicker size="touch" />
        {item.kind === 'track' && <LikeButton trackId={item.id} size="touch" />}
        <IconButton label={isPlaying ? 'Pause' : 'Play'} size="touch" onClick={() => void togglePlay()} className="!text-fg">
          {isPlaying ? <Pause className="size-6 fill-current" aria-hidden /> : <Play className="size-6 fill-current" aria-hidden />}
        </IconButton>
      </div>
      {/* On the bottom edge, inset 8px (clear of the 8px corners). 6px+ below the buttons. */}
      <div className="absolute inset-x-2 bottom-0 h-0.5 overflow-hidden rounded-full bg-white/25" aria-hidden>
        <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
      </div>
    </Card>
  );
}

/**
 * Remote mode, nothing active. While the device list is being retried (≈10s) it says so;
 * after that it shows the hint with "Open Spotify" (wakes the app via the spotify: URL
 * scheme; when you switch back, the devices are looked up again automatically).
 */
function DeviceHint() {
  const searching = usePlayer((s) => s.searchingDevices);
  const last = getLastDevice();

  // Let play() know the banner is showing, so it doesn't toast the same text.
  useEffect(() => {
    usePlayer.setState({ deviceHintVisible: true });
    return () => usePlayer.setState({ deviceHintVisible: false });
  }, []);

  if (searching) {
    return (
      <Card style={{ backgroundColor: '#282828' }}>
        <div role="status" className="flex min-h-14 items-center gap-3 px-3 text-sm">
          <Loader2 className="size-5 shrink-0 animate-spin text-accent-ink" aria-hidden />
          <p className="min-w-0 flex-1 leading-snug text-fg-muted">
            {last ? `Looking for ${last.name}…` : 'Looking for your Spotify devices…'}
          </p>
        </div>
      </Card>
    );
  }
  return (
    <Card style={{ backgroundColor: '#282828' }}>
      <div role="status" className="p-3 text-sm">
        <div className="flex items-start gap-3">
          <Smartphone className="mt-0.5 size-5 shrink-0 text-accent-ink" aria-hidden />
          <p className="min-w-0 flex-1 leading-snug">{NO_DEVICE_HINT}</p>
        </div>
        <div className="mt-2 flex items-center justify-end gap-2">
          <DevicePicker size="touch" />
          {/* Custom URL scheme: iOS asks to open the Spotify app. Same window, so the PWA stays put. */}
          <a
            href="spotify:"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-4 font-bold text-on-accent active:bg-accent-press"
          >
            <ExternalLink className="size-4" aria-hidden />
            Open Spotify
          </a>
        </div>
      </div>
    </Card>
  );
}
