import { ArrowDownUp, Ellipsis, ListPlus, ListX, Pencil, Play, Plus, Search, Shuffle, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { openContextMenu } from '../../components/ContextMenu';
import { HScroller } from '../../components/HScroller';
import { Menu, type MenuItem } from '../../components/Menu';
import { OfflineTrackRow } from '../../components/offline/OfflineTrackRow';
import { localSetShuffle, playQueue } from '../../offline/engine';
import {
  addToPlaylist,
  createPlaylist,
  deletePlaylist,
  playableFromMeta,
  removeTrack,
  updatePlaylist,
  useOffline,
} from '../../offline/store';
import type { TrackMeta } from '../../offline/types';

type Sort = 'recent' | 'title' | 'artist';
const SORTS: { key: Sort; label: string }[] = [
  { key: 'recent', label: 'Recently added' },
  { key: 'title', label: 'Title' },
  { key: 'artist', label: 'Artist' },
];

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/** Downloaded + imported tracks: search, sort, offline playlists, delete. Works with no internet. */
export function DownloadedSection() {
  const tracks = useOffline((s) => s.tracks);
  const playlists = useOffline((s) => s.playlists);
  const loaded = useOffline((s) => s.loaded);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const [view, setView] = useState<string | null>(null); // playlist id, or null = all downloads
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const playlist = playlists.find((p) => p.id === view) ?? null;

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byId = new Map(tracks.map((t) => [t.id, t]));
    let base: TrackMeta[] = playlist
      ? playlist.trackIds.map((id) => byId.get(id)).filter((t): t is TrackMeta => !!t)
      : [...tracks];
    if (q) base = base.filter((t) => `${t.title} ${t.artist} ${t.album ?? ''}`.toLowerCase().includes(q));
    if (!playlist) {
      if (sort === 'recent') base.sort((a, b) => b.addedAt - a.addedAt);
      else if (sort === 'title') base.sort((a, b) => collator.compare(a.title, b.title));
      else base.sort((a, b) => collator.compare(a.artist, b.artist) || collator.compare(a.title, b.title));
    }
    return base;
  }, [tracks, playlist, query, sort]);

  const playables = useMemo(() => list.map(playableFromMeta), [list]);

  const playAll = (shuffled: boolean) => {
    if (!playables.length) return;
    localSetShuffle(shuffled);
    playQueue(playables, shuffled ? Math.floor(Math.random() * playables.length) : 0);
  };

  const rowMenu = (t: TrackMeta) => (x: number, y: number, el: HTMLElement) => {
    const items: MenuItem[] = playlists
      .filter((p) => p.id !== view)
      .map((p) => ({ id: `add-${p.id}`, label: `Add to “${p.name}”`, icon: ListPlus, onSelect: () => void addToPlaylist(p.id, t.id) }));
    if (playlist) {
      items.push({
        label: 'Remove from this playlist',
        icon: ListX,
        separatorBefore: items.length > 0,
        onSelect: () => void updatePlaylist(playlist.id, { trackIds: playlist.trackIds.filter((id) => id !== t.id) }),
      });
    }
    items.push({
      label: 'Delete download',
      icon: Trash2,
      separatorBefore: items.length > 0,
      onSelect: () => {
        if (window.confirm(`Delete “${t.title}” from this device?`)) void removeTrack(t.id);
      },
    });
    openContextMenu(x, y, items, el);
  };

  if (loaded && tracks.length === 0) {
    return (
      <p className="py-8 text-fg-muted">
        Nothing downloaded yet. Save free tracks from Discover or Audius, or import your own music files.
      </p>
    );
  }

  return (
    <div>
      <HScroller label="Offline playlists" className="mb-4" trackClassName="flex gap-2">
        <Chip selected={view === null} onClick={() => setView(null)}>
          All downloads
        </Chip>
        {playlists.map((p) => (
          <Chip key={p.id} selected={view === p.id} onClick={() => setView(p.id)}>
            {p.name} · {p.trackIds.length}
          </Chip>
        ))}
        <Chip onClick={() => setCreating(true)} aria-label="New offline playlist">
          <Plus className="mr-1 size-4" aria-hidden /> New playlist
        </Chip>
      </HScroller>

      {creating && (
        <form
          className="mb-4 flex items-center gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const p = await createPlaylist(newName);
            setNewName('');
            setCreating(false);
            setView(p.id);
          }}
        >
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Playlist name"
            aria-label="Playlist name"
            className="h-11 min-w-0 flex-1 rounded-sm bg-elevated px-3 text-base outline-none focus:shadow-[inset_0_0_0_2px_var(--color-accent-ink)]"
          />
          <Button size="sm" type="submit">
            Create
          </Button>
          <Button size="sm" variant="tertiary" type="button" onClick={() => setCreating(false)}>
            Cancel
          </Button>
        </form>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => playAll(false)} disabled={!playables.length}>
          <Play className="size-4 fill-current" aria-hidden /> Play all
        </Button>
        <Button size="sm" variant="secondary" onClick={() => playAll(true)} disabled={!playables.length}>
          <Shuffle className="size-4" aria-hidden /> Shuffle
        </Button>
        <label className="ml-auto flex h-10 min-w-0 flex-1 basis-40 items-center gap-2 rounded-sm bg-elevated px-3 text-sm sm:max-w-64">
          <Search className="size-4 shrink-0 text-fg-muted" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={playlist ? `Search in ${playlist.name}` : 'Search downloads'}
            aria-label="Search downloads"
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-fg-muted"
          />
        </label>
        {playlist ? (
          <Menu
            items={[
              {
                label: 'Rename playlist',
                icon: Pencil,
                onSelect: () => {
                  const name = window.prompt('Playlist name', playlist.name);
                  if (name?.trim()) void updatePlaylist(playlist.id, { name: name.trim() });
                },
              },
              {
                label: 'Delete playlist',
                icon: Trash2,
                onSelect: () => {
                  if (window.confirm(`Delete the playlist “${playlist.name}”? Downloads stay on your device.`)) {
                    void deletePlaylist(playlist.id);
                    setView(null);
                  }
                },
              },
            ]}
            trigger={(props) => (
              <button type="button" aria-label="Playlist options" className="flex size-11 items-center justify-center text-fg-muted hover:text-fg" {...props}>
                <Ellipsis className="size-5" aria-hidden />
              </button>
            )}
          />
        ) : (
          <Menu
            header={<p className="text-xs font-bold text-fg-muted">Sort by</p>}
            items={SORTS.map((s) => ({ id: s.key, label: s.label, checked: sort === s.key, onSelect: () => setSort(s.key) }))}
            trigger={(props) => (
              <button type="button" aria-label="Sort downloads" className="flex size-11 items-center justify-center text-fg-muted hover:text-fg" {...props}>
                <ArrowDownUp className="size-5" aria-hidden />
              </button>
            )}
          />
        )}
      </div>

      {playlist && playlist.trackIds.length === 0 && (
        <p className="py-6 text-sm text-fg-muted">This playlist is empty. Use ⋯ on a download → “Add to …”.</p>
      )}
      {list.length === 0 && query && <p className="py-6 text-sm text-fg-muted">Nothing matches “{query}”.</p>}

      <div role="list" aria-label={playlist ? playlist.name : 'Downloaded tracks'}>
        {list.map((t, i) => (
          <div role="listitem" key={t.id}>
            <OfflineTrackRow playable={playables[i]} index={i} onPlay={() => playQueue(playables, i)} onMenu={rowMenu(t)} />
          </div>
        ))}
      </div>
    </div>
  );
}
