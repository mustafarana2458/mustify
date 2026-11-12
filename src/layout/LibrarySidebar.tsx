import { ArrowDownUp, Library, Plus, Search, Volume2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink } from 'react-router';
import { AUTHOR } from '../brand/info';
import { AccountMenu } from '../components/AccountMenu';
import { Artwork } from '../components/Artwork';
import { Chip, ClearChip } from '../components/Chip';
import { HScroller } from '../components/HScroller';
import { IconButton } from '../components/IconButton';
import { Menu } from '../components/Menu';
import { ScrollArea } from '../components/ScrollArea';
import { plural } from '../lib/format';
import { withViewTransition } from '../lib/viewTransition';
import { usePlayer } from '../player/store';
import { loadLibrary, sortEntries, useLibrary, type LibraryEntry, type LibraryKind, type LibrarySort } from '../store/library';
import { useLayout } from '../store/layout';

const FILTERS: { kind: LibraryKind; label: string }[] = [
  { kind: 'playlist', label: 'Playlists' },
  { kind: 'artist', label: 'Artists' },
  { kind: 'album', label: 'Albums' },
  { kind: 'show', label: 'Podcasts' },
];

const KIND_LABEL: Record<LibraryKind, string> = { playlist: 'Playlist', artist: 'Artist', album: 'Album', show: 'Podcast' };

const SORTS: { key: LibrarySort; label: string }[] = [
  { key: 'recent', label: 'Recently added' },
  { key: 'alpha', label: 'Alphabetical' },
  { key: 'creator', label: 'Creator' },
];

const interactive = (isActive: boolean) =>
  `rounded-md transition-colors duration-150 hover:bg-tint hover:duration-[50ms] active:bg-surface-press ${
    isActive ? 'bg-tint-hover' : ''
  }`;

/** Compact library row: 48px cover + 8px padding = 64px tall. */
const rowClass = ({ isActive }: { isActive: boolean }) => `flex h-16 items-center gap-3 px-2 ${interactive(isActive)}`;

/** Collapsed rail cell: 48px cover in a 64px square. */
const railClass = ({ isActive }: { isActive: boolean }) => `flex size-16 items-center justify-center ${interactive(isActive)}`;

function RowText({ title, subtitle, playing }: { title: string; subtitle: string; playing: boolean }) {
  return (
    <span className="min-w-0 flex-1 leading-5">
      <span className={`block truncate text-[15px] ${playing ? 'text-accent-ink' : ''}`}>{title}</span>
      <span className="block truncate text-sm text-fg-muted">{subtitle}</span>
    </span>
  );
}

function subtitleFor(e: LibraryEntry): string {
  return e.kind === 'artist' ? KIND_LABEL.artist : `${KIND_LABEL[e.kind]} · ${e.creator}`;
}

/**
 * Your Library (UI-SPEC §1.3, data §5.2): playlists, saved albums, followed artists and saved
 * podcasts from the Web API, with type filters, a name filter and three sort orders.
 */
export function LibrarySidebar({ collapsed, variant = 'panel' }: { collapsed: boolean; variant?: 'panel' | 'page' }) {
  const toggleLeft = useLayout((s) => s.toggleLeft);
  const sort = useLayout((s) => s.librarySort);
  const setSort = useLayout((s) => s.setLibrarySort);
  const { entries, status, failed, likedTotal } = useLibrary();
  const contextUri = usePlayer((s) => s.contextUri);
  const isPlaying = usePlayer((s) => s.isPlaying);
  const [filter, setFilter] = useState<LibraryKind | null>(null);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    void loadLibrary();
  }, []);

  const presentKinds = useMemo(() => new Set(entries.map((e) => e.kind)), [entries]);
  // If the active filter's kind disappears (e.g. you unfollow the last artist), clear it.
  useEffect(() => {
    if (filter && status === 'ready' && !presentKinds.has(filter)) setFilter(null);
  }, [filter, presentKinds, status]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortEntries(
      entries.filter(
        (e) => (!filter || e.kind === filter) && (!q || e.name.toLowerCase().includes(q) || e.creator.toLowerCase().includes(q)),
      ),
      sort,
    );
  }, [entries, filter, query, sort]);

  const isPlayingEntry = (uri: string) => contextUri === uri;
  const likedPlaying = !!contextUri && contextUri.endsWith(':collection');
  const showLiked = (!filter || filter === 'playlist') && (!query || 'liked songs'.includes(query.trim().toLowerCase()));
  const likedSubtitle = likedTotal != null ? `Playlist · ${plural(likedTotal, 'song')}` : 'Playlist';

  const toggle = () => withViewTransition(toggleLeft);

  if (collapsed) {
    return (
      <nav aria-label="Your library" className="flex h-full flex-col items-center gap-2 pt-2">
        <IconButton label="Expand your library" size="lg" onClick={toggle}>
          <Library className="size-6" aria-hidden />
        </IconButton>
        <IconButton label="Create playlist (not available yet)" size="md" filled disabled>
          <Plus className="size-5" aria-hidden />
        </IconButton>
        <ScrollArea className="w-full flex-1">
          <ul className="flex flex-col items-center pt-1 pb-2">
            <li>
              <NavLink to="/collection/tracks" title="Liked Songs" aria-label="Liked Songs" className={railClass}>
                <Artwork liked px={48} className="size-12 rounded-sm" />
              </NavLink>
            </li>
            {sortEntries(entries, sort).map((e) => (
              <li key={e.uri}>
                <NavLink to={e.to} title={e.name} aria-label={e.name} className={railClass}>
                  <Artwork images={e.images} round={e.kind === 'artist'} px={48} className="size-12 rounded-sm" />
                </NavLink>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </nav>
    );
  }

  return (
    <nav aria-label="Your library" className="flex h-full min-w-0 flex-col">
      {variant === 'page' ? (
        // Mobile "Your Library" tab: account avatar + title, no collapse.
        <header className="flex items-center gap-3 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-2">
          <AccountMenu size={40} align="start" />
          <h1 className="text-2xl font-bold tracking-tight">Your Library</h1>
        </header>
      ) : (
      <header className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
        <button
          type="button"
          onClick={toggle}
          title="Collapse your library"
          className="flex min-w-0 items-center gap-3 rounded-sm font-bold text-fg-muted transition-colors hover:text-fg"
        >
          <Library className="size-6 shrink-0" aria-hidden />
          <span className="truncate">Your Library</span>
        </button>
        {/* Creating playlists needs a name/details flow; not part of this phase. */}
        <IconButton label="Create playlist (not available yet)" size="sm" filled disabled>
          <Plus className="size-4" aria-hidden />
        </IconButton>
      </header>
      )}

      {presentKinds.size > 1 && (
        <HScroller label="Library filters" className="mx-4 mt-1 mb-2" trackClassName="flex gap-2">
          {filter && <ClearChip onClick={() => setFilter(null)} />}
          {FILTERS.filter((f) => presentKinds.has(f.kind) && (!filter || f.kind === filter)).map((f) => (
            <Chip key={f.kind} selected={filter === f.kind} onClick={() => setFilter(filter === f.kind ? null : f.kind)}>
              {f.label}
            </Chip>
          ))}
        </HScroller>
      )}

      <div className="flex items-center justify-between gap-2 px-4 pb-1">
        {searchOpen ? (
          <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-sm bg-elevated px-2 text-sm">
            <Search className="size-4 shrink-0 text-fg-muted" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onBlur={() => !query && setSearchOpen(false)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setQuery('');
                  setSearchOpen(false);
                }
              }}
              placeholder="Search in Your Library"
              aria-label="Search in Your Library"
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-fg-muted"
            />
          </label>
        ) : (
          <IconButton label="Search in Your Library" size="sm" onClick={() => setSearchOpen(true)}>
            <Search className="size-4" aria-hidden />
          </IconButton>
        )}
        <Menu
          align="end"
          header={<p className="text-xs font-bold text-fg-muted">Sort by</p>}
          items={SORTS.map((s) => ({ id: s.key, label: s.label, checked: sort === s.key, onSelect: () => setSort(s.key) }))}
          trigger={(props) => (
            <button
              type="button"
              aria-label={`Sort: ${SORTS.find((s) => s.key === sort)?.label}`}
              className="flex shrink-0 items-center gap-1.5 rounded-sm px-1 text-sm text-fg-muted transition-colors hover:text-fg"
              {...props}
            >
              {SORTS.find((s) => s.key === sort)?.label}
              <ArrowDownUp className="size-4" aria-hidden />
            </button>
          )}
        />
      </div>

      <ScrollArea className="flex-1">
        {status === 'error' ? (
          <div className="p-4 text-sm text-fg-muted">
            <p className="mb-2">Couldn't load your library.</p>
            <button type="button" className="font-bold text-fg hover:underline" onClick={() => void loadLibrary(true)}>
              Try again
            </button>
          </div>
        ) : (
          <ul className="px-2 pb-2" aria-busy={status === 'loading'}>
            {showLiked && (
              <li>
                <NavLink to="/collection/tracks" className={rowClass}>
                  <Artwork liked px={48} className="size-12 shrink-0 rounded-sm" />
                  <RowText title="Liked Songs" subtitle={likedSubtitle} playing={likedPlaying} />
                  {likedPlaying && isPlaying && <Volume2 className="size-4 shrink-0 text-accent-ink" aria-label="Playing" />}
                </NavLink>
              </li>
            )}
            {status === 'loading' && entries.length === 0
              ? Array.from({ length: 6 }, (_, i) => (
                  <li key={i} className="flex h-16 items-center gap-3 px-2" aria-hidden>
                    <span className="size-12 animate-pulse rounded-sm bg-fg/10" />
                    <span className="flex-1 space-y-2">
                      <span className="block h-3 w-2/3 rounded-full bg-fg/10" />
                      <span className="block h-3 w-1/3 rounded-full bg-fg/10" />
                    </span>
                  </li>
                ))
              : list.map((e) => {
                  const playing = isPlayingEntry(e.uri);
                  return (
                    <li key={e.uri}>
                      <NavLink to={e.to} className={rowClass}>
                        <Artwork images={e.images} round={e.kind === 'artist'} px={48} className="size-12 shrink-0 rounded-sm" />
                        <RowText title={e.name} subtitle={subtitleFor(e)} playing={playing} />
                        {playing && isPlaying && <Volume2 className="size-4 shrink-0 text-accent-ink" aria-label="Playing" />}
                      </NavLink>
                    </li>
                  );
                })}
            {status === 'ready' && list.length === 0 && !showLiked && (
              <li className="p-4 text-sm text-fg-muted">{query ? 'Nothing matches.' : 'Nothing here yet.'}</li>
            )}
            {failed.length > 0 && status === 'ready' && (
              <li className="px-2 pt-3 text-xs text-fg-muted">Couldn't load: {failed.join(', ')}.</li>
            )}
          </ul>
        )}
      </ScrollArea>
      <footer className="shrink-0 px-4 pt-2 pb-3">
        <Link to="/about" className="text-[11px] text-fg-muted transition-colors hover:text-fg hover:underline">
          Designed &amp; built by {AUTHOR.name}
        </Link>
      </footer>
    </nav>
  );
}
