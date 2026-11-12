import { ChevronLeft } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import type { PlayTarget } from '../api/home';
import { ApiError } from '../api/client';
import type { EntityKind } from '../api/saved';
import { useEntitySaved } from '../api/saved';
import type { SpotifyImage } from '../api/types';
import { useScrolledPast } from '../layout/mainScroll';
import { Artwork } from './Artwork';
import { useSafeAreaTop } from '../lib/safeArea';
import { useIsMobileLayout } from '../lib/useMediaQuery';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { SaveIconButton } from './LikeButton';
import { PlayButton } from './PlayButton';

export const STICKY_BAR_H = 64;

function titleSize(title: string): string {
  // Sizes in container-inline units of the page, capped by the spec's larger-5 (96px).
  if (title.length <= 20) return 'text-[clamp(2rem,8cqi,6rem)]';
  if (title.length <= 40) return 'text-[clamp(2rem,5.5cqi,4.5rem)]';
  return 'text-[clamp(1.75rem,4cqi,3rem)]';
}

interface EntityLayoutProps {
  /** Header colour (already contrast-adjusted, see useHeaderColor). */
  color: string;
  typeLabel: string;
  title: string;
  images?: SpotifyImage[] | null;
  round?: boolean;
  liked?: boolean;
  description?: string;
  meta?: ReactNode;
  playTarget?: PlayTarget;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Shared frame for playlist / album / artist / Liked Songs pages (UI-SPEC §4.2, §4.3):
 *   - header painted with the cover colour, fading toward the surface at the bottom
 *   - a 232px gradient continuing behind the action row
 *   - a sticky 64px bar that fills with the header colour and shows play + title once the
 *     action row has scrolled under it
 */
export function EntityLayout({
  color,
  typeLabel,
  title,
  images,
  round,
  liked,
  description,
  meta,
  playTarget,
  actions,
  children,
}: EntityLayoutProps) {
  const [actionRow, setActionRow] = useState<HTMLDivElement | null>(null);
  // The sticky bar also covers the status-bar area (installed iPhone app), so its total
  // height is 64px + the top safe-area inset (0 on desktop).
  const safeTop = useSafeAreaTop();
  const barH = STICKY_BAR_H + safeTop;
  const past = useScrolledPast(actionRow, barH);
  const barColor = `color-mix(in oklab, ${color} 85%, var(--color-surface))`;
  const mobile = useIsMobileLayout();
  const navigate = useNavigate();

  return (
    <div className="@container relative min-h-full">
      <div
        className="sticky top-0 z-20 flex items-center gap-2 px-6 transition-[background-color] duration-200 max-md:px-2"
        style={{
          backgroundColor: past ? barColor : 'transparent',
          height: barH,
          paddingTop: safeTop,
          marginBottom: -barH,
        }}
      >
        {/* Mobile has no top bar, so entity pages carry their own back button. */}
        {mobile && (
          <IconButton label="Go back" size="touch" filled onClick={() => navigate(-1)}>
            <ChevronLeft className="size-6" aria-hidden />
          </IconButton>
        )}
        <div
          aria-hidden={!past}
          className={`flex min-w-0 items-center gap-3 transition-opacity duration-200 ${past ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        >
          {playTarget && !mobile && <PlayButton target={playTarget} label={title} />}
          <span className="truncate text-2xl font-bold max-md:text-lg">{title}</span>
        </div>
      </div>

      {/* Narrow containers stack the cover above the title (mobile). */}
      <header
        // Header colour runs up behind the status bar; content starts below it.
        className="flex min-h-[340px] flex-col items-start gap-6 px-6 pt-[calc(5rem+env(safe-area-inset-top))] pb-6 @[520px]:flex-row @[520px]:items-end max-md:min-h-0 max-md:px-4"
        style={{
          background: `linear-gradient(transparent 0%, color-mix(in oklab, var(--color-surface) 45%, transparent) 100%), ${color}`,
        }}
      >
        <Artwork
          images={images}
          liked={liked}
          round={round}
          px={232}
          className="aspect-square w-[min(62cqi,260px)] shrink-0 self-center rounded-sm shadow-[0_4px_60px_#00000080] @[520px]:w-[clamp(128px,22cqi,232px)] @[520px]:self-auto"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{typeLabel}</p>
          <h1 className={`line-clamp-3 py-2 leading-none font-extrabold tracking-tight break-words ${titleSize(title)}`}>{title}</h1>
          {description && <p className="mt-1 line-clamp-2 text-sm text-fg/80">{description}</p>}
          {meta && <div className="mt-2 flex flex-wrap items-center gap-x-1 text-sm">{meta}</div>}
        </div>
      </header>

      <div className="relative px-6 pb-10 max-md:px-4">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[232px]"
          style={{ background: `linear-gradient(color-mix(in oklab, ${color} 35%, transparent), transparent)` }}
        />
        <div ref={setActionRow} className="relative flex items-center gap-6 py-6">
          {playTarget && <PlayButton target={playTarget} label={title} size="lg" />}
          {actions}
        </div>
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}

/**
 * Save/remove toggle for albums, playlists and shows, next to the big play button.
 * Same ⊕ / filled ✓ look as track likes. Hidden if the endpoint is unavailable.
 */
export function SaveToggle({ kind, id }: { kind: Exclude<EntityKind, 'artist'>; id: string; name?: string }) {
  const [saved, toggle] = useEntitySaved(kind, id);
  if (saved === 'error') return null;
  return (
    <SaveIconButton
      saved={saved}
      onToggle={toggle}
      labels={['Save to Your Library', 'Remove from Your Library']}
      size="lg"
    />
  );
}

/** Follow / Following button for artists. Hidden if unavailable. */
export function FollowButton({ id }: { id: string }) {
  const [following, toggle] = useEntitySaved('artist', id);
  if (following === 'error') return null;
  return (
    <Button variant="secondary" size="sm" disabled={following === undefined} aria-pressed={following === true} onClick={toggle}>
      {following ? 'Following' : 'Follow'}
    </Button>
  );
}

/** Loading / error states for entity pages. */
export function PageState({ error, what }: { error?: Error; what: string }) {
  if (!error) {
    return (
      <div className="px-6 pt-[calc(6rem+env(safe-area-inset-top))]" aria-busy>
        <div className="flex items-end gap-6">
          <div className="size-[232px] animate-pulse rounded-sm bg-fg/10" />
          <div className="flex-1 space-y-4">
            <div className="h-4 w-24 rounded-full bg-fg/10" />
            <div className="h-12 w-2/3 rounded-full bg-fg/10" />
            <div className="h-4 w-1/3 rounded-full bg-fg/10" />
          </div>
        </div>
      </div>
    );
  }
  const status = error instanceof ApiError ? error.status : 0;
  return (
    <div className="px-6 pt-[calc(6rem+env(safe-area-inset-top))] text-center">
      <h1 className="mb-2 text-2xl font-bold">Couldn't open this {what}</h1>
      <p className="mx-auto max-w-md text-sm text-fg-muted">
        {status === 404 || status === 403
          ? what === 'playlist'
            ? "Spotify doesn't let new apps open some playlists, such as its own editorial and personalised mixes."
            : "It doesn't exist, or Spotify doesn't make it available to this app."
          : error.message}
      </p>
    </div>
  );
}
