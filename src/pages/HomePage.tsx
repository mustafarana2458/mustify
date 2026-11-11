import { useEffect, useMemo, useState } from 'react';
import { getRecentlyPlayed, loadQuickAccess, recentTrackItems, trackItem, type HomeItem } from '../api/home';
import { useApi, useAsync } from '../api/hooks';
import { albumItem as albumCard, artistItem, playlistItem, savedShowItem } from '../api/items';
import type {
  AlbumSimplified,
  Artist,
  Paging,
  PlayHistory,
  PlaylistSimplified,
  SavedAlbum,
  SavedShow,
  Track,
  UserProfile,
} from '../api/types';
import { AccountMenu } from '../components/AccountMenu';
import { Chip } from '../components/Chip';
import { HScroller } from '../components/HScroller';
import { NotAvailableCard } from '../components/NotAvailableCard';
import { QuickTile, QuickTileSkeleton } from '../components/QuickTile';
import { Shelf } from '../components/Shelf';
import { useIsMobileLayout } from '../lib/useMediaQuery';

type Filter = 'all' | 'music' | 'podcasts';

// Wrapped so Array.map's index argument can't be mistaken for albumCard's subtitle option.
const albumItem = (a: AlbumSimplified) => albumCard(a);

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/** Turns a paged/list response into card items; undefined while loading. */
function useItems<R, T>(path: string | null, pick: (r: R) => T[], map: (t: T) => HomeItem) {
  const q = useApi<R>(path);
  // A failing shelf (e.g. an endpoint restricted for new apps) just disappears; log it once.
  useEffect(() => {
    if (q.error) console.warn(`Home shelf ${path} failed:`, q.error.message);
  }, [q.error, path]);
  // pick/map are stable module-level functions in practice; only the data matters.
  const items = useMemo(() => (q.data ? pick(q.data).filter(Boolean).map(map) : undefined), [q.data]);
  return { items, loading: q.loading };
}

/**
 * Home (UI-SPEC §5.3). Data, all from the official Web API:
 *   quick-access grid  ⚠️ recently-played contexts (see api/home.ts), topped up with playlists
 *   Recently played    GET /me/player/recently-played
 *   Your top artists   GET /me/top/artists
 *   Your top tracks    GET /me/top/tracks
 *   Your playlists     GET /me/playlists
 *   Saved albums       GET /me/albums
 *   New releases       GET /browse/new-releases
 *   Your shows         GET /me/shows
 *   Made for you       ❌ no official equivalent → placeholder card
 */
export function HomePage() {
  const [filter, setFilter] = useState<Filter>('all');
  const mobile = useIsMobileLayout();
  const { data: me } = useApi<UserProfile>('/me');

  const history = useAsync<PlayHistory[]>(
    () => getRecentlyPlayed().then((r) => r.items).catch(() => []),
    [],
  );
  // Wait for /me too, so the Liked Songs tile can use your user id.
  const quick = useAsync<HomeItem[]>(
    history.data && me ? () => loadQuickAccess(history.data!, me.id) : null,
    [history.data, me?.id],
  );
  const recent = useMemo(() => (history.data ? recentTrackItems(history.data) : undefined), [history.data]);

  const topArtists = useItems<Paging<Artist>, Artist>('/me/top/artists?limit=20&time_range=short_term', (r) => r.items, artistItem);
  const topTracks = useItems<Paging<Track>, Track>('/me/top/tracks?limit=20&time_range=short_term', (r) => r.items, trackItem);
  const playlists = useItems<Paging<PlaylistSimplified>, PlaylistSimplified>('/me/playlists?limit=20', (r) => r.items, playlistItem);
  const albums = useItems<Paging<SavedAlbum>, AlbumSimplified>('/me/albums?limit=20', (r) => r.items.map((s) => s.album), albumItem);
  const newReleases = useItems<{ albums: Paging<AlbumSimplified> }, AlbumSimplified>(
    '/browse/new-releases?limit=20',
    (r) => r.albums.items,
    albumItem,
  );
  const shows = useItems<Paging<SavedShow>, SavedShow>('/me/shows?limit=20', (r) => r.items, savedShowItem);

  const music = filter !== 'podcasts';
  const podcasts = filter !== 'music';

  return (
    <div className="@container bg-gradient-to-b from-header to-surface to-[320px] px-6 pt-4 pb-10 max-md:px-4">
      <div className="mb-4 flex items-center gap-3">
        {/* Mobile has no top bar: the account menu lives here. */}
        {mobile && <AccountMenu size={36} align="start" />}
        <HScroller label="Home filters" className="min-w-0 flex-1" trackClassName="flex gap-2">
          {(['all', 'music', 'podcasts'] as const).map((f) => (
            <Chip key={f} selected={filter === f} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'music' ? 'Music' : 'Podcasts'}
            </Chip>
          ))}
        </HScroller>
      </div>

      {filter === 'all' && (
        <>
          <h1 className="sr-only">
            {greeting()}
            {me?.display_name ? `, ${me.display_name}` : ''}
          </h1>
          {/*
            Spec §3.2: repeat(auto-fill, minmax(max(270px, 25%), 1fr)), gap 8px, tile 48px;
            ≥1141px container → 64px tiles + 12px gap; ≥1599px → 80px tiles.
          */}
          {quick.error ? (
            <p className="mb-8 text-sm text-fg-muted">Couldn't load your shortcuts: {quick.error.message}</p>
          ) : quick.data?.length === 0 ? (
            <p className="mb-8 text-sm text-fg-muted">Play something and your shortcuts will appear here.</p>
          ) : (
            // Below 600px the spec's 270px minimum would leave one column; phones get two.
            <div className="mb-8 grid grid-cols-[repeat(auto-fill,minmax(max(270px,25%),1fr))] gap-2 [--tile-h:48px] @max-[599px]:grid-cols-2 @[1141px]:gap-3 @[1141px]:[--tile-h:64px] @[1599px]:[--tile-h:80px]">
              {quick.data
                ? quick.data.map((item) => <QuickTile key={item.key} item={item} />)
                : Array.from({ length: 8 }, (_, i) => <QuickTileSkeleton key={i} />)}
            </div>
          )}
        </>
      )}

      {music && (
        <>
          <Shelf title="Recently played" items={recent} loading={history.loading} />
          <Shelf title="Your top artists" {...topArtists} />
          <Shelf title="Your top tracks" {...topTracks} />
          <Shelf title="Your playlists" {...playlists} />
          <Shelf title="Saved albums" {...albums} />
          <Shelf title="New releases" {...newReleases} />
          <Shelf title="Made for you">
            <NotAvailableCard title="Personalised mixes" className="max-w-md" />
          </Shelf>
        </>
      )}
      {podcasts && <Shelf title="Your shows" {...shows} />}
    </div>
  );
}
