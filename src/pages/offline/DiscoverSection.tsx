import { ChevronLeft, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Artwork } from '../../components/Artwork';
import { Chip } from '../../components/Chip';
import { HScroller } from '../../components/HScroller';
import { IconButton } from '../../components/IconButton';
import { DownloadButton, OfflineTrackRow } from '../../components/offline/OfflineTrackRow';
import { playQueue } from '../../offline/engine';
import {
  JAMENDO_GENRES,
  jamendoAlbums,
  jamendoArtists,
  jamendoConfigured,
  jamendoDownloadSpec,
  jamendoId,
  jamendoPlayable,
  jamendoTracks,
  PAGE_SIZE,
  type JAlbum,
  type JArtist,
  type JTrack,
} from '../../offline/jamendo';
import { downloadTrack, preferDownloaded, useOffline } from '../../offline/store';
import { useDebounced, usePaged } from '../../offline/usePaged';

type Mode = 'tracks' | 'albums' | 'artists';
type Open = { kind: 'album' | 'artist'; id: string; name: string } | null;

function LoadMore({ show, loading, onClick }: { show: boolean; loading: boolean; onClick: () => void }) {
  if (!show && !loading) return null;
  return (
    <div className="py-4 text-center">
      <button type="button" disabled={loading} onClick={onClick} className="min-h-11 px-4 text-sm font-bold text-fg-muted hover:text-fg">
        {loading ? 'Loading…' : 'Load more'}
      </button>
    </div>
  );
}

function TrackResults({ tracks }: { tracks: JTrack[] }) {
  // Prefer the downloaded copy when there is one (plays with no internet); recomputed when
  // downloads change, so a just-saved track plays from the device.
  const downloads = useOffline((s) => s.tracks);
  const playables = useMemo(() => tracks.map((t) => preferDownloaded(jamendoPlayable(t))), [tracks, downloads]);
  return (
    <div role="list">
      {tracks.map((t, i) => {
        const spec = jamendoDownloadSpec(t);
        return (
          <div role="listitem" key={t.id}>
            <OfflineTrackRow
              playable={playables[i]}
              index={i}
              onPlay={() => playQueue(playables, i)}
              actions={<DownloadButton id={jamendoId(t)} allowed={!!spec} onDownload={() => spec && void downloadTrack(spec)} />}
            />
          </div>
        );
      })}
    </div>
  );
}

/** Jamendo: free, Creative Commons music. Browse popular / by genre, or search tracks, albums, artists. */
export function DiscoverSection() {
  const [mode, setMode] = useState<Mode>('tracks');
  const [text, setText] = useState('');
  const q = useDebounced(text.trim(), 400);
  const [genre, setGenre] = useState<string | null>(null);
  const [open, setOpen] = useState<Open>(null);

  const trackKey = open ? `${open.kind}:${open.id}` : mode === 'tracks' ? `t:${q}:${genre ?? ''}` : null;
  const tracks = usePaged<JTrack>(
    jamendoConfigured() ? trackKey : null,
    (offset) =>
      open
        ? jamendoTracks({ offset, ...(open.kind === 'album' ? { albumId: open.id } : { artistId: open.id }) })
        : jamendoTracks({ offset, search: q || undefined, tags: q ? undefined : (genre ?? undefined) }),
    PAGE_SIZE,
  );
  const albums = usePaged<JAlbum>(jamendoConfigured() && !open && mode === 'albums' ? `a:${q}` : null, (o) => jamendoAlbums(q, o), PAGE_SIZE);
  const artists = usePaged<JArtist>(jamendoConfigured() && !open && mode === 'artists' ? `r:${q}` : null, (o) => jamendoArtists(q, o), PAGE_SIZE);

  if (!jamendoConfigured()) {
    return (
      <div className="rounded-lg bg-elevated p-4 text-sm">
        <p className="mb-2 font-bold">Jamendo isn't set up yet</p>
        <p className="text-fg-muted">
          Create a free client id at devportal.jamendo.com, then add <code>VITE_JAMENDO_CLIENT_ID=…</code> to your <code>.env</code>{' '}
          (and to your Netlify environment variables) and rebuild.
        </p>
      </div>
    );
  }

  if (open) {
    return (
      <div>
        <div className="mb-3 flex items-center gap-2">
          <IconButton label="Back to results" size="touch" filled onClick={() => setOpen(null)}>
            <ChevronLeft className="size-6" aria-hidden />
          </IconButton>
          <div className="min-w-0">
            <p className="text-xs text-fg-muted">{open.kind === 'album' ? 'Album' : 'Artist'} on Jamendo</p>
            <h2 className="truncate text-xl font-bold">{open.name}</h2>
          </div>
        </div>
        {tracks.error && <p className="text-sm text-danger">{tracks.error.message}</p>}
        <TrackResults tracks={tracks.items} />
        <LoadMore show={tracks.hasMore} loading={tracks.loading} onClick={tracks.loadMore} />
      </div>
    );
  }

  const active = mode === 'tracks' ? tracks : mode === 'albums' ? albums : artists;

  return (
    <div>
      <label className="mb-3 flex h-11 items-center gap-2 rounded-full bg-elevated px-4">
        <Search className="size-5 shrink-0 text-fg-muted" aria-hidden />
        <input
          type="search"
          enterKeyHint="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search free music on Jamendo"
          aria-label="Search Jamendo"
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-fg-muted"
        />
      </label>

      <HScroller label="Jamendo view" className="mb-3" trackClassName="flex gap-2">
        {(['tracks', 'albums', 'artists'] as const).map((m) => (
          <Chip key={m} selected={mode === m} onClick={() => setMode(m)}>
            {m === 'tracks' ? 'Tracks' : m === 'albums' ? 'Albums' : 'Artists'}
          </Chip>
        ))}
      </HScroller>

      {mode === 'tracks' && !q && (
        <HScroller label="Genres" className="mb-4" trackClassName="flex gap-2">
          <Chip selected={genre === null} onClick={() => setGenre(null)}>
            Popular this week
          </Chip>
          {JAMENDO_GENRES.map((g) => (
            <Chip key={g} selected={genre === g} onClick={() => setGenre(g)}>
              {g[0].toUpperCase() + g.slice(1)}
            </Chip>
          ))}
        </HScroller>
      )}

      {active.error && <p className="mb-3 text-sm text-danger">{active.error.message}</p>}

      {mode === 'tracks' && <TrackResults tracks={tracks.items} />}

      {mode === 'albums' && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
          {albums.items.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setOpen({ kind: 'album', id: a.id, name: a.name })}
              className="flex flex-col gap-2 rounded-md p-2 text-left transition-colors hover:bg-tint"
            >
              <Artwork images={a.image ? [{ url: a.image, width: 300, height: 300 }] : []} px={150} className="aspect-square w-full rounded-md" />
              <span className="min-w-0">
                <span className="block truncate font-bold">{a.name}</span>
                <span className="block truncate text-sm text-fg-muted">{a.artist_name}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {mode === 'artists' && (
        <div role="list">
          {artists.items.map((a) => (
            <button
              role="listitem"
              key={a.id}
              type="button"
              onClick={() => setOpen({ kind: 'artist', id: a.id, name: a.name })}
              className="flex min-h-16 w-full items-center gap-3 rounded-sm px-2 text-left transition-colors hover:bg-tint"
            >
              <Artwork images={a.image ? [{ url: a.image, width: null, height: null }] : []} round px={48} className="size-12" />
              <span className="truncate">{a.name}</span>
            </button>
          ))}
        </div>
      )}

      {!active.loading && active.items.length === 0 && !active.error && (
        <p className="py-6 text-sm text-fg-muted">No results{q ? ` for “${q}”` : ''}.</p>
      )}
      <LoadMore show={active.hasMore} loading={active.loading} onClick={active.loadMore} />

      <p className="mt-6 text-xs text-fg-muted">
        Music from Jamendo under Creative Commons licences. “Save offline” only appears where the artist allows downloads;
        the licence and artist are shown on every track.
      </p>
    </div>
  );
}
