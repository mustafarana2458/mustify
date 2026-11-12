import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { HomeItem } from '../api/home';
import { useApi } from '../api/hooks';
import { albumItem, artistItem, playlistItem, showItem } from '../api/items';
import { rowFromTrack, type RowTrack } from '../api/normalize';
import { usePagingContinuation } from '../api/paging';
import type { AlbumSimplified, Artist, Paging, PlaylistSimplified, ShowSimplified, SpotifyImage, Track } from '../api/types';
import { Artwork } from '../components/Artwork';
import { Chip } from '../components/Chip';
import { HScroller } from '../components/HScroller';
import { MediaCard, MediaCardSkeleton } from '../components/MediaCard';
import { PlayButton } from '../components/PlayButton';
import { SearchInput } from '../components/SearchInput';
import { useIsMobileLayout } from '../lib/useMediaQuery';
import { Shelf } from '../components/Shelf';
import { TrackList } from '../components/TrackList';
import { placeholderGradient } from '../lib/artwork';
import { useNearBottom } from '../layout/mainScroll';
import { play } from '../player/controls';

/*
 * Search (UI-SPEC §5.4): GET /search?q=…&type=…  (the top bar debounces typing, 300ms).
 * "Top result" ranking has no official equivalent; it is a heuristic here (see pickTopResult).
 * With no query: GET /browse/categories as a grid (category colours aren't in the API, so the
 * tiles use generated colours; tapping one searches for it, since category playlists are
 * restricted for new apps).
 */

type Filter = 'all' | 'track' | 'artist' | 'album' | 'playlist' | 'show';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'track', label: 'Songs' },
  { key: 'artist', label: 'Artists' },
  { key: 'album', label: 'Albums' },
  { key: 'playlist', label: 'Playlists' },
  { key: 'show', label: 'Podcasts' },
];

const RESULT_KEY = { track: 'tracks', artist: 'artists', album: 'albums', playlist: 'playlists', show: 'shows' } as const;

// Kept at 10: the per-request maximum has been lowered for some apps; more pages load on scroll.
const LIMIT = 10;

interface SearchResponse {
  tracks?: Paging<Track | null>;
  artists?: Paging<Artist | null>;
  albums?: Paging<AlbumSimplified | null>;
  playlists?: Paging<PlaylistSimplified | null>;
  shows?: Paging<ShowSimplified | null>;
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '');

interface TopResult extends HomeItem {
  kind: string;
}

/** Exact artist name match wins, then a track whose title starts with the query, then firsts. */
function pickTopResult(q: string, r: SearchResponse): TopResult | null {
  const nq = norm(q);
  const artists = (r.artists?.items ?? []).filter((x): x is Artist => !!x);
  const tracks = (r.tracks?.items ?? []).filter((x): x is Track => !!x);
  const albums = (r.albums?.items ?? []).filter((x): x is AlbumSimplified => !!x);
  const a = artists.find((x) => norm(x.name) === nq);
  if (a) return { ...artistItem(a), kind: 'Artist' };
  const t = tracks.find((x) => norm(x.name).startsWith(nq));
  if (t) return trackTop(t);
  if (artists[0]) return { ...artistItem(artists[0]), kind: 'Artist' };
  if (tracks[0]) return trackTop(tracks[0]);
  if (albums[0]) return { ...albumItem(albums[0]), kind: 'Album' };
  return null;
}

function trackTop(t: Track): TopResult {
  return {
    key: t.uri,
    title: t.name,
    subtitle: t.artists.map((a) => a.name).join(', '),
    images: t.album.images,
    to: `/album/${t.album.id}`,
    play: { uris: [t.uri] },
    kind: 'Song',
  };
}

function TopResultCard({ item }: { item: TopResult }) {
  return (
    <div className="group/top relative flex h-full flex-col gap-5 rounded-lg bg-elevated p-5 transition-colors duration-300 hover:bg-elevated-hover">
      <Artwork images={item.images} round={item.round} px={92} className="size-[92px] rounded-md shadow-card" />
      <div className="min-w-0">
        <Link to={item.to} className="line-clamp-2 text-3xl font-bold tracking-tight outline-none after:absolute after:inset-0">
          {item.title}
        </Link>
        <p className="mt-1 flex items-center gap-2 text-sm text-fg-muted">
          <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-fg">{item.kind}</span>
          {item.kind !== 'Artist' && <span className="truncate">{item.subtitle}</span>}
        </p>
      </div>
      {item.play && (
        <PlayButton
          target={item.play}
          label={item.title}
          className="absolute right-5 bottom-5 z-10 translate-y-2 opacity-0 group-hover/top:translate-y-0 group-hover/top:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100 data-[playing]:translate-y-0 data-[playing]:opacity-100"
        />
      )}
    </div>
  );
}

function trackRows(tracks: (Track | null)[] | undefined): RowTrack[] {
  return (tracks ?? []).map((t, i) => rowFromTrack(t, `${t?.uri}#${i}`)).filter((r): r is RowTrack => r !== null);
}

interface Category {
  id: string;
  name: string;
  icons: SpotifyImage[];
}

function BrowseCategories() {
  const { data, loading, error } = useApi<{ categories: Paging<Category> }>('/browse/categories?limit=50');
  if (error) return <p className="text-sm text-fg-muted">Type to search songs, artists, albums, playlists and podcasts.</p>;
  return (
    <section>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Browse all</h1>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
        {loading
          ? Array.from({ length: 12 }, (_, i) => <div key={i} className="aspect-[16/10] animate-pulse rounded-lg bg-fg/10" />)
          : data?.categories.items.map((c) => (
              <Link
                key={c.id}
                to={`/search?q=${encodeURIComponent(c.name)}`}
                className="relative aspect-[16/10] overflow-hidden rounded-lg p-4 text-xl font-bold text-white transition-transform duration-150 hover:scale-[1.02]"
                style={{ background: placeholderGradient(c.name) }}
              >
                <span className="relative z-10 drop-shadow-[0_1px_2px_#0006]">{c.name}</span>
                {c.icons[0] && (
                  <img
                    src={c.icons[0].url}
                    alt=""
                    loading="lazy"
                    className="absolute -right-4 -bottom-2 size-24 rotate-[25deg] rounded-sm shadow-card"
                  />
                )}
              </Link>
            ))}
      </div>
    </section>
  );
}

/** Card grid for a single result type, with infinite loading. */
function CardResults({ initial, pickKey, toItem }: {
  initial: Paging<unknown | null> | undefined;
  pickKey: (typeof RESULT_KEY)[Exclude<Filter, 'all' | 'track'>];
  toItem: (x: never) => HomeItem;
}) {
  const pick = useCallback((r: unknown) => (r as Record<string, Paging<unknown | null>>)[pickKey], [pickKey]);
  const paged = usePagingContinuation<unknown | null>(initial, pick);
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);
  useNearBottom(sentinel, paged.loadMore, paged.hasMore && !paged.loadingMore);
  const items = paged.items.filter((x) => x !== null).map((x) => toItem(x as never));
  if (initial && items.length === 0) return <p className="text-fg-muted">No results.</p>;
  return (
    <>
      <div className="-mx-3 grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
        {initial ? items.map((it) => <MediaCard key={it.key} item={it} />) : Array.from({ length: 10 }, (_, i) => <MediaCardSkeleton key={i} />)}
      </div>
      {paged.hasMore && <div ref={setSentinel} className="py-4 text-center text-sm text-fg-muted">{paged.loadingMore ? 'Loading more…' : ''}</div>}
    </>
  );
}

function SongResults({ initial }: { initial: Paging<Track | null> | undefined }) {
  const pick = useCallback((r: unknown) => (r as SearchResponse).tracks, []);
  const paged = usePagingContinuation<Track | null>(initial, pick);
  const rows = useMemo(() => trackRows(paged.items), [paged.items]);
  const onPlay = useCallback((_r: RowTrack, i: number) => void play({ uris: rows.map((r) => r.uri), offsetPosition: i }), [rows]);
  if (initial && rows.length === 0) return <p className="text-fg-muted">No songs found.</p>;
  return (
    <TrackList
      label="Songs"
      rows={rows}
      onPlay={onPlay}
      columns={{ cover: true, album: true }}
      stickyTop={0}
      hasMore={paged.hasMore}
      loadingMore={paged.loadingMore}
      onLoadMore={paged.loadMore}
    />
  );
}

export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get('q')?.trim() ?? '';
  const [filter, setFilter] = useState<Filter>('all');
  const mobile = useIsMobileLayout();
  const types =filter === 'all' ? 'track,artist,album,playlist,show' : filter;
  const { data, loading, error } = useApi<SearchResponse>(
    q ? `/search?q=${encodeURIComponent(q)}&type=${types}&limit=${LIMIT}` : null,
  );

  const top = useMemo(() => (data && filter === 'all' ? pickTopResult(q, data) : null), [data, q, filter]);
  const songs = useMemo(() => trackRows(data?.tracks?.items).slice(0, 4), [data]);
  const onPlaySong = useCallback(
    (_r: RowTrack, i: number) => void play({ uris: songs.map((s) => s.uri), offsetPosition: i }),
    [songs],
  );
  const list = <T,>(p: Paging<T | null> | undefined) => (p?.items ?? []).filter((x): x is T => !!x);

  // Mobile has no top bar, so the search box sits at the top of this page.
  const mobileHeader = mobile && (
    <div className="mb-4">
      <h1 className="mb-3 text-2xl font-bold tracking-tight">Search</h1>
      <SearchInput />
    </div>
  );

  if (!q) {
    return (
      <div className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-10 max-md:px-4 max-md:pt-[calc(0.5rem+env(safe-area-inset-top))]">
        {mobileHeader}
        <BrowseCategories />
      </div>
    );
  }

  return (
    <div className="@container px-6 pt-[calc(1rem+env(safe-area-inset-top))] pb-10 max-md:px-4 max-md:pt-[calc(0.5rem+env(safe-area-inset-top))]">
      {mobileHeader}
      <HScroller label="Search filters" className="mb-6" trackClassName="flex gap-2">
        {FILTERS.map((f) => (
          <Chip key={f.key} selected={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label}
          </Chip>
        ))}
      </HScroller>

      {error && <p className="text-danger">Search failed: {error.message}</p>}

      {filter === 'all' && (
        <>
          {!loading && data && !top && songs.length === 0 && (
            <p className="text-fg-muted">No results for “{q}”. Check the spelling or try fewer words.</p>
          )}
          {(top || songs.length > 0 || loading) && (
            <div className="mb-10 grid gap-6 @[900px]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <section>
                <h2 className="mb-4 text-2xl font-bold tracking-tight">Top result</h2>
                {top ? <TopResultCard item={top} /> : <div className="h-[236px] animate-pulse rounded-lg bg-fg/10" />}
              </section>
              <section>
                <h2 className="mb-4 text-2xl font-bold tracking-tight">Songs</h2>
                <TrackList label="Top songs" rows={songs} onPlay={onPlaySong} columns={{ cover: true }} showHeader={false} />
              </section>
            </div>
          )}
          <Shelf title="Artists" loading={loading} items={list(data?.artists).map(artistItem)} />
          <Shelf title="Albums" loading={loading} items={list(data?.albums).map((a) => albumItem(a))} />
          <Shelf title="Playlists" loading={loading} items={list(data?.playlists).map(playlistItem)} />
          <Shelf title="Podcasts" loading={loading} items={list(data?.shows).map(showItem)} />
        </>
      )}

      {/* key={q} resets paging when the query changes */}
      {filter === 'track' && <SongResults key={q} initial={data?.tracks} />}
      {filter === 'artist' && <CardResults key={q} initial={data?.artists} pickKey="artists" toItem={artistItem as (x: never) => HomeItem} />}
      {filter === 'album' && <CardResults key={q} initial={data?.albums} pickKey="albums" toItem={((a: AlbumSimplified) => albumItem(a)) as (x: never) => HomeItem} />}
      {filter === 'playlist' && <CardResults key={q} initial={data?.playlists} pickKey="playlists" toItem={playlistItem as (x: never) => HomeItem} />}
      {filter === 'show' && <CardResults key={q} initial={data?.shows} pickKey="shows" toItem={showItem as (x: never) => HomeItem} />}
    </div>
  );
}
