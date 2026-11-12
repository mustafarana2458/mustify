import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { useApi } from '../api/hooks';
import { albumItem } from '../api/items';
import { rowFromTrack, type RowTrack } from '../api/normalize';
import type { AlbumSimplified, Artist, Paging, Track } from '../api/types';
import { EntityLayout, FollowButton, PageState } from '../components/EntityPage';
import { Shelf } from '../components/Shelf';
import { TrackList } from '../components/TrackList';
import { useHeaderColor } from '../lib/dominantColor';
import { plural } from '../lib/format';
import { play } from '../player/controls';
import { useAppearance } from '../store/appearance';

type DiscographyAlbum = AlbumSimplified & { album_group?: string };

const GROUPS: { key: string; title: string }[] = [
  { key: 'album', title: 'Albums' },
  { key: 'single', title: 'Singles and EPs' },
  { key: 'compilation', title: 'Compilations' },
  { key: 'appears_on', title: 'Appears on' },
];

const POPULAR_COLLAPSED = 5; // shown before "See more"

/**
 * Artist page (UI-SPEC §5.7):
 *   header      GET /artists/{id}  (image, name, followers if provided)
 *   Popular     GET /artists/{id}/top-tracks?market=from_token
 *   Discography GET /artists/{id}/albums?include_groups=album,single,compilation,appears_on
 *   Follow      /me/following?type=artist
 *   ❌ no official equivalent, not shown: monthly listeners, banner image, About/bio,
 *      Fans also like (related artists, restricted since Nov 2024).
 */
export function ArtistPage() {
  const { id } = useParams();
  const accent = useAppearance((s) => s.accent);
  const { data: artist, error } = useApi<Artist>(id ? `/artists/${id}` : null);
  const top = useApi<{ tracks: Track[] }>(id ? `/artists/${id}/top-tracks?market=from_token` : null);
  const disco = useApi<Paging<DiscographyAlbum>>(
    id ? `/artists/${id}/albums?include_groups=album,single,compilation,appears_on&limit=50` : null,
  );
  const color = useHeaderColor(artist?.images, accent);
  const [expanded, setExpanded] = useState(false);

  const topRows = useMemo(
    () => (top.data?.tracks ?? []).map((t, i) => rowFromTrack(t, `${t.uri}#${i}`)).filter((r): r is RowTrack => r !== null),
    [top.data],
  );
  const groups = useMemo(() => {
    const by = new Map<string, DiscographyAlbum[]>();
    for (const a of disco.data?.items ?? []) {
      const g = a.album_group ?? a.album_type;
      by.set(g, [...(by.get(g) ?? []), a]);
    }
    return by;
  }, [disco.data]);

  const onPlayTop = useCallback(
    (_row: RowTrack, index: number) => void play({ uris: topRows.map((r) => r.uri), offsetPosition: index }),
    [topRows],
  );

  if (!artist || !id) return <PageState error={error} what="artist" />;

  return (
    <EntityLayout
      color={color}
      typeLabel="Artist"
      title={artist.name}
      images={artist.images}
      round
      playTarget={{ contextUri: artist.uri }}
      actions={<FollowButton id={id} />}
      meta={artist.followers?.total != null && <span className="text-fg/80">{plural(artist.followers.total, 'follower')}</span>}
    >
      <section className="mb-10">
        <h2 className="mb-4 text-2xl font-bold tracking-tight">Popular</h2>
        {top.error ? (
          <p className="text-sm text-fg-muted">Popular tracks aren't available for this artist right now.</p>
        ) : top.loading ? (
          <p className="text-sm text-fg-muted">Loading…</p>
        ) : (
          <>
            <TrackList
              label={`Popular tracks by ${artist.name}`}
              rows={expanded ? topRows : topRows.slice(0, POPULAR_COLLAPSED)}
              onPlay={onPlayTop}
              columns={{ cover: true }}
              showHeader={false}
            />
            {topRows.length > POPULAR_COLLAPSED && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="mt-3 px-4 text-sm font-bold text-fg-muted hover:text-fg"
              >
                {expanded ? 'Show less' : 'See more'}
              </button>
            )}
          </>
        )}
      </section>

      {GROUPS.map(({ key, title }) => (
        <Shelf
          key={key}
          title={title}
          loading={disco.loading}
          items={groups.get(key)?.map((a) => albumItem(a, key === 'appears_on' ? 'artists' : 'year-type'))}
        />
      ))}

    </EntityLayout>
  );
}
