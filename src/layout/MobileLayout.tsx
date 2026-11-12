import { Download, ExternalLink, House, Library, Loader2, Pause, Play, Search, Smartphone, Speaker } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { Artwork } from '../components/Artwork';
import { OfflineBadge, OfflineGate } from '../components/OfflineGate';
import { DevicePicker, NO_DEVICE_HINT } from '../components/DevicePicker';
import { IconButton } from '../components/IconButton';
import { LikeButton } from '../components/LikeButton';
import { useHeaderColor } from '../lib/dominantColor';
import { playHere, togglePlay } from '../player/controls';
import { getLastDevice } from '../player/lastDevice';
import { selectIsLocal, usePlayer } from '../player/store';
import { selectOtherDeviceName } from '../player/target';
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
 *   │  ┌─────────────────────┐  │ ← mini player (glass): 8px above the pill, 12px sides
 *   │  └─────────────────────┘  │
 *   │  (  glass pill tab bar  )  │ ← 64px, 12px sides, 8px above the home indicator
 *   └───────────────────────────┘ ← screen bottom (home indicator)
 *
 * The layout fills #root (100vh = the full 932px screen in the installed app). The pill and
 * mini player are position:absolute inside it, measured from its bottom; never position:fixed,
 * which iOS anchors to a shorter (873px) viewport in standalone mode. The page itself runs to
 * the very bottom behind the pill, and ends with a spacer as tall as pill + mini player + gaps
 * so the last row isn't hidden.
 */

// Floating "glass" pill tab bar (iOS 26 style) and mini player. Chosen sizes:
const PILL_H = 64; // px
const EDGE = 12; // px from the left/right screen edges
const GAP = 8; // px above the home indicator, and between mini player and pill
const PILL_BOTTOM_CSS = `calc(env(safe-area-inset-bottom) + ${GAP}px)`;
const MINI_BOTTOM_CSS = `calc(env(safe-area-inset-bottom) + ${GAP + PILL_H + GAP}px)`;

/** Pill tint: the theme's page background with a hint of the accent (works on every theme). */
const PILL_TINT = 'color-mix(in oklab, var(--color-surface) 90%, var(--color-accent))';

/** Frosted glass: translucent tint, blurred + saturated backdrop, 1px inner highlight, soft shadow. */
function glass(tint: string, alphaPct: number): CSSProperties {
  return {
    backgroundColor: `color-mix(in oklab, ${tint} ${alphaPct}%, transparent)`,
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.18), 0 10px 30px rgba(0, 0, 0, 0.28), 0 2px 8px rgba(0, 0, 0, 0.16)',
  };
}

/** The active tab's lighter glass "bubble". */
const BUBBLE_STYLE: CSSProperties = {
  backgroundColor: 'color-mix(in oklab, color-mix(in oklab, var(--color-fg) 88%, var(--color-accent)) 13%, transparent)',
  backdropFilter: 'blur(12px) saturate(160%)',
  WebkitBackdropFilter: 'blur(12px) saturate(160%)',
  boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.12)',
};

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
    // Fills #root (100vh = the full screen in the installed app). Everything at the bottom is
    // absolutely positioned inside it, never position:fixed (iOS anchors fixed elements to a
    // shorter viewport). The page runs to the very bottom, behind the floating pill.
    <div className="relative h-full overflow-hidden bg-surface">
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
        {/* Room for the floating pill + mini player (+ gaps) so the last row is reachable. */}
        <div
          aria-hidden
          style={{ height: `calc(env(safe-area-inset-bottom) + ${GAP + PILL_H + GAP}px + ${floatH ? floatH + GAP : 0}px)` }}
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
 * Floating glass pill, 12px from the sides and 8px above the home indicator. The active tab
 * sits on a lighter glass bubble that slides between tabs with a springy overshoot (300ms)
 * and squishes/stretches while it moves. Icons 24px with 10.5px labels; light press scale.
 */
function TabBar() {
  const { pathname } = useLocation();
  const active = TABS.findIndex((t) => t.match(pathname));
  // Keep the bubble where it was on pages that aren't a tab (e.g. an album), just hidden.
  const [bubbleAt, setBubbleAt] = useState(Math.max(0, active));
  const moved = useRef(false);
  useEffect(() => {
    if (active >= 0 && active !== bubbleAt) {
      moved.current = true;
      setBubbleAt(active);
    }
  }, [active, bubbleAt]);

  return (
    <nav
      aria-label="Main"
      className="absolute z-30 flex rounded-full p-1"
      style={{ left: EDGE, right: EDGE, bottom: PILL_BOTTOM_CSS, height: PILL_H, ...glass(PILL_TINT, 55) }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute top-1 bottom-1 left-1"
        style={{
          width: `calc((100% - 8px) / ${TABS.length})`,
          transform: `translateX(${bubbleAt * 100}%)`,
          transition: 'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease',
          opacity: active >= 0 ? 1 : 0,
        }}
      >
        {/* Re-keyed on every move so the squish animation replays (not on first render). */}
        <span key={bubbleAt} className={`block size-full rounded-full ${moved.current ? 'liquid-squish' : ''}`} style={BUBBLE_STYLE} />
      </span>
      {TABS.map(({ to, label, icon: Icon }, i) => {
        const on = i === active;
        return (
          <NavLink
            key={to}
            to={to}
            aria-current={on ? 'page' : undefined}
            className={
              'relative z-10 flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full ' +
              'transition-[transform,color] duration-150 ease-out active:scale-[0.92] ' +
              (on ? 'text-fg' : 'text-fg-muted')
            }
          >
            <Icon className="size-6 shrink-0" strokeWidth={on ? 2.6 : 2} aria-hidden />
            <span className={`block max-w-full truncate px-1 text-[10.5px] leading-[13px] ${on ? 'font-bold' : 'font-medium'}`}>{label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

/**
 * Floats 8px above the pill, with the same 12px side margins. Shows the mini player, or (remote mode,
 * nothing active) the device hint. Reports its height so the scroller can leave room for it.
 */
function FloatingPlayer({ onOpen, onHeight }: { onOpen: () => void; onHeight: (h: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const item = usePlayer((s) => s.item);
  const mode = usePlayer((s) => s.mode);
  const device = usePlayer((s) => s.device);
  const phoneMissing = usePlayer((s) => s.phoneDeviceMissing);
  const otherDevice = usePlayer(selectOtherDeviceName);
  // Stack, top to bottom: "Playing on <device> · Play here", the "Open Spotify" hint (this
  // phone's Spotify app wasn't found; never fall back to a computer), the mini player.
  const showHint = mode === 'remote' && (phoneMissing || (!item && !device));
  const content =
    otherDevice || showHint || item ? (
      <div className="flex flex-col gap-2">
        {otherDevice && !showHint && <OtherDeviceBar name={otherDevice} />}
        {showHint && <DeviceHint />}
        {item && <MiniPlayer onOpen={onOpen} />}
      </div>
    ) : null;

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
      className="absolute z-30"
      style={{ left: EDGE, right: EDGE, bottom: MINI_BOTTOM_CSS }}
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

/** Glass card matching the pill: tinted with `tint` (dark enough for white text), blurred backdrop. */
function Card({ children, tint, style }: { children: ReactNode; tint: string; style?: CSSProperties }) {
  return (
    <div className="relative rounded-[22px] text-fg" style={{ ...ON_DARK, ...glass(tint, 78), ...style }}>
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
    <Card tint={color} style={{ transition: 'background-color 500ms var(--ease-productive)' }}>
      <div className="flex h-14 items-center gap-2 pr-2">
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
        {/* Controls grouped at the right edge: [device] [like] [play/pause], 40px each, 6px apart.
            The active-device dot sits under the device icon, inside its button. */}
        <div className="flex shrink-0 items-center gap-1.5">
          <DevicePicker size="md" />
          {item.kind === 'track' && <LikeButton trackId={item.id} size="md" collapse />}
          <IconButton label={isPlaying ? 'Pause' : 'Play'} size="md" onClick={() => void togglePlay()} className="!text-fg">
            {isPlaying ? <Pause className="size-6 fill-current" aria-hidden /> : <Play className="size-6 fill-current" aria-hidden />}
          </IconButton>
        </div>
      </div>
      {/* On the bottom edge, inset 18px so it stays clear of the 22px rounded corners. */}
      <div className="absolute inset-x-[18px] bottom-0 h-0.5 overflow-hidden rounded-full bg-white/25" aria-hidden>
        <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
      </div>
    </Card>
  );
}

/** Another device is playing: say which, and offer to move playback to this phone. */
function OtherDeviceBar({ name }: { name: string }) {
  return (
    <Card tint="#282828">
      <div role="status" className="flex min-h-12 items-center gap-2 py-1 pr-1.5 pl-3 text-sm">
        <Speaker className="size-4 shrink-0 text-accent" aria-hidden />
        <p className="min-w-0 flex-1 truncate">
          Playing on <span className="font-bold">{name}</span>
        </p>
        <button
          type="button"
          onClick={() => void playHere()}
          className="inline-flex min-h-10 shrink-0 items-center rounded-full bg-accent px-4 text-sm font-bold text-on-accent active:bg-accent-press"
        >
          Play here
        </button>
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
      <Card tint="#282828">
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
    <Card tint="#282828">
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
