import { useCallback, useMemo } from 'react';
import { useParams } from 'react-router';
import { useApi } from '../api/hooks';
import { rowFromPlaylistEntry, type PlaylistEntry, type RowTrack } from '../api/normalize';
import { usePagingContinuation } from '../api/paging';
import type { Paging, PlaylistSimplified, UserProfile } from '../api/types';
import { EntityLayout, PageState, SaveToggle } from '../components/EntityPage';
import { TrackList } from '../components/TrackList';
import { useHeaderColor } from '../lib/dominantColor';
import { formatTotal, htmlToText, plural } from '../lib/format';
import { play } from '../player/controls';
import { useAppearance } from '../store/appearance';

interface PlaylistFull extends PlaylistSimplified {
  public?: boolean | null;
  collaborative?: boolean;
  followers?: { total: number };
  /** Older responses embed tracks under `tracks`; newer ones may use `items`. */
  tracks?: Paging<PlaylistEntry>;
  items?: Paging<PlaylistEntry>;
}

/**
 * Playlist page (UI-SPEC §5.5):
 *   header       GET /playlists/{id}   (+ first 100 entries; further pages via `next`)
 *   save/follow  /playlists/{id}/followers  (hidden for your own playlists)
 *   play from row  PUT /me/player/play {context_uri, offset.position}
 * "Recommended songs" below the list has no official equivalent and is not shown.
 */
export function PlaylistPage() {
  const { id } = useParams();
  const accent = useAppearance((s) => s.accent);
  const { data: me } = useApi<UserProfile>('/me');
  const { data: pl, error } = useApi<PlaylistFull>(id ? `/playlists/${id}` : null);
  const paged = usePagingContinuation<PlaylistEntry>(pl ? (pl.tracks ?? pl.items) : undefined);
  const rows = useMemo(
    () => paged.items.map((e, i) => rowFromPlaylistEntry(e, i)).filter((r): r is RowTrack => r !== null),
    [paged.items],
  );
  const color = useHeaderColor(pl?.images, accent);

  const onPlay = useCallback(
    (row: RowTrack, index: number) => pl && void play({ contextUri: pl.uri, offsetPosition: row.position ?? index }),
    [pl],
  );

  if (!pl || !id) return <PageState error={error} what="playlist" />;

  const total = paged.total || rows.length;
  const allLoaded = !paged.hasMore;
  const durationMs = rows.reduce((sum, r) => sum + r.durationMs, 0);
  const owner = pl.owner.display_name ?? pl.owner.id;

  return (
    <EntityLayout
      color={color}
      typeLabel={pl.public === false ? 'Private playlist' : 'Playlist'}
      title={pl.name}
      images={pl.images}
      description={htmlToText(pl.description)}
      playTarget={rows.length ? { contextUri: pl.uri } : undefined}
      actions={pl.owner.id !== me?.id && <SaveToggle kind="playlist" id={id} name={pl.name} />}
      meta={
        <>
          <span className="font-bold">{owner}</span>
          {pl.followers?.total ? <span className="text-fg/80">· {plural(pl.followers.total, 'save')}</span> : null}
          <span className="text-fg/80">
            · {plural(total, 'song')}
            {allLoaded && durationMs > 0 ? `, ${formatTotal(durationMs)}` : ''}
          </span>
        </>
      }
    >
      {rows.length === 0 && !paged.hasMore ? (
        <p className="py-8 text-fg-muted">This playlist is empty.</p>
      ) : (
        <TrackList
          label={`${pl.name} tracks`}
          rows={rows}
          onPlay={onPlay}
          columns={{ cover: true, album: true, added: true }}
          totalCount={total}
          hasMore={paged.hasMore}
          loadingMore={paged.loadingMore}
          onLoadMore={paged.loadMore}
        />
      )}
    </EntityLayout>
  );
}
