import { Fragment, useCallback, useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { useApi } from '../api/hooks';
import { albumItem } from '../api/items';
import { rowFromTrack, type RowTrack, type TrackLike } from '../api/normalize';
import { usePagingContinuation } from '../api/paging';
import type { AlbumSimplified, Paging } from '../api/types';
import { EntityLayout, PageState, SaveToggle } from '../components/EntityPage';
import { Shelf } from '../components/Shelf';
import { TrackList } from '../components/TrackList';
import { useHeaderColor } from '../lib/dominantColor';
import { formatReleaseDate, formatTotal, plural } from '../lib/format';
import { play } from '../player/controls';
import { useAppearance } from '../store/appearance';

interface AlbumFull extends AlbumSimplified {
  tracks: Paging<TrackLike>;
  label?: string;
  copyrights?: { text: string; type: string }[];
}

const TYPE_LABEL: Record<string, string> = { album: 'Album', single: 'Single', compilation: 'Compilation' };

/**
 * Album page (UI-SPEC §5.6):
 *   GET /albums/{id} (+ track pages), save via /me/albums, "More by" via /artists/{id}/albums.
 * (Multi-disc albums are shown as one continuous list.)
 */
export function AlbumPage() {
  const { id } = useParams();
  const accent = useAppearance((s) => s.accent);
  const { data: album, error } = useApi<AlbumFull>(id ? `/albums/${id}` : null);
  const paged = usePagingContinuation<TrackLike>(album?.tracks);
  const rows = useMemo(
    () =>
      album
        ? paged.items
            .map((t, i) => rowFromTrack(t, `${t.uri}#${i}`, { album }))
            .filter((r): r is RowTrack => r !== null)
        : [],
    [paged.items, album],
  );
  const color = useHeaderColor(album?.images, accent);
  const mainArtist = album?.artists[0];
  const more = useApi<Paging<AlbumSimplified>>(
    mainArtist ? `/artists/${mainArtist.id}/albums?include_groups=album,single&limit=10` : null,
  );
  const moreItems = useMemo(
    () => more.data?.items.filter((a) => a.id !== id).map((a) => albumItem(a, 'year-type')),
    [more.data, id],
  );

  const onPlay = useCallback(
    (_row: RowTrack, index: number) => album && void play({ contextUri: album.uri, offsetPosition: index }),
    [album],
  );

  if (!album || !id) return <PageState error={error} what="album" />;

  const durationMs = rows.reduce((s, r) => s + r.durationMs, 0);

  return (
    <EntityLayout
      color={color}
      typeLabel={TYPE_LABEL[album.album_type] ?? 'Album'}
      title={album.name}
      images={album.images}
      playTarget={{ contextUri: album.uri }}
      actions={<SaveToggle kind="album" id={id} name={album.name} />}
      meta={
        <>
          <span className="font-bold">
            {album.artists.map((a, i) => (
              <Fragment key={a.id}>
                {i > 0 && ', '}
                <Link to={`/artist/${a.id}`} className="hover:underline">
                  {a.name}
                </Link>
              </Fragment>
            ))}
          </span>
          <span className="text-fg/80">· {album.release_date?.slice(0, 4)}</span>
          <span className="text-fg/80">
            · {plural(album.total_tracks ?? rows.length, 'song')}
            {!paged.hasMore && durationMs > 0 ? `, ${formatTotal(durationMs)}` : ''}
          </span>
        </>
      }
    >
      <TrackList
        label={`${album.name} tracks`}
        rows={rows}
        onPlay={onPlay}
        totalCount={album.total_tracks}
        hasMore={paged.hasMore}
        loadingMore={paged.loadingMore}
        onLoadMore={paged.loadMore}
      />

      <div className="mt-8 mb-10 text-xs text-fg-muted">
        <p className="mb-1 text-sm">{formatReleaseDate(album.release_date)}</p>
        {album.copyrights?.map((c) => (
          <p key={c.type + c.text}>
            {/* The API text usually already contains the ©/℗ symbol. */}
            {/^[©℗(]/.test(c.text) ? c.text : `${c.type === 'P' ? '℗' : '©'} ${c.text}`}
          </p>
        ))}
      </div>

      {mainArtist && <Shelf title={`More by ${mainArtist.name}`} items={moreItems} loading={more.loading} />}
    </EntityLayout>
  );
}
