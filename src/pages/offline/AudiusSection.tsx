import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Chip } from '../../components/Chip';
import { HScroller } from '../../components/HScroller';
import { DownloadButton, OfflineTrackRow } from '../../components/offline/OfflineTrackRow';
import {
  AUDIUS_GENRES,
  audiusDownloadable,
  audiusDownloadSpec,
  audiusId,
  audiusPlayable,
  audiusSearch,
  audiusStreamable,
  audiusTrending,
  type ATrack,
} from '../../offline/audius';
import { playQueue } from '../../offline/engine';
import { downloadTrack, isDownloaded, preferDownloaded, useOffline } from '../../offline/store';
import { useDebounced, usePaged } from '../../offline/usePaged';

/** Audius: search and trending. Streams in the app; "Save offline" only for artist-enabled downloads. */
export function AudiusSection() {
  const [text, setText] = useState('');
  const q = useDebounced(text.trim(), 400);
  const [genre, setGenre] = useState<string | null>(null);
  // Audius search/trending return one page; usePaged keeps loading state consistent.
  const results = usePaged<ATrack>(`${q}|${genre ?? ''}`, (offset) => (offset > 0 ? Promise.resolve([]) : q ? audiusSearch(q) : audiusTrending(genre ?? undefined)), 1000);

  const downloads = useOffline((s) => s.tracks);
  // Only playable tracks go into the queue (streamable, or already downloaded).
  const rows = useMemo(
    () =>
      results.items.map((t) => {
        const playable = preferDownloaded(audiusPlayable(t));
        return { t, playable, canPlay: audiusStreamable(t) || isDownloaded(audiusId(t)) };
      }),
    [results.items, downloads],
  );
  const queue = useMemo(() => rows.filter((r) => r.canPlay).map((r) => r.playable), [rows]);

  return (
    <div>
      <label className="mb-3 flex h-11 items-center gap-2 rounded-full bg-elevated px-4">
        <Search className="size-5 shrink-0 text-fg-muted" aria-hidden />
        <input
          type="search"
          enterKeyHint="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search Audius"
          aria-label="Search Audius"
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-fg-muted"
        />
      </label>

      {!q && (
        <HScroller label="Audius genres" className="mb-4" trackClassName="flex gap-2">
          <Chip selected={genre === null} onClick={() => setGenre(null)}>
            Trending this week
          </Chip>
          {AUDIUS_GENRES.map((g) => (
            <Chip key={g} selected={genre === g} onClick={() => setGenre(g)}>
              {g}
            </Chip>
          ))}
        </HScroller>
      )}

      {results.error && <p className="mb-3 text-sm text-danger">{results.error.message}</p>}
      {results.loading && results.items.length === 0 && <p className="py-6 text-sm text-fg-muted">Loading…</p>}

      <div role="list">
        {rows.map(({ t, playable, canPlay }, i) => (
          <div role="listitem" key={t.id}>
            <OfflineTrackRow
              playable={playable}
              index={i}
              unavailable={canPlay ? undefined : 'Not available to stream'}
              onPlay={() => playQueue(queue, queue.indexOf(playable))}
              actions={
                <DownloadButton
                  id={audiusId(t)}
                  allowed={audiusDownloadable(t)}
                  onDownload={() => void audiusDownloadSpec(t).then((spec) => spec && downloadTrack(spec))}
                />
              }
            />
          </div>
        ))}
      </div>

      {!results.loading && results.items.length === 0 && !results.error && (
        <p className="py-6 text-sm text-fg-muted">No results{q ? ` for “${q}”` : ''}.</p>
      )}

      <p className="mt-6 text-xs text-fg-muted">
        Music from Audius, streamed with the artist's permission. “Save offline” only appears on tracks the artist has made
        downloadable.
      </p>
    </div>
  );
}
