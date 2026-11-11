import { useCallback, useMemo } from 'react';
import { likedSongsUri } from '../api/home';
import { api } from '../api/client';
import { useApi, useAsync } from '../api/hooks';
import { useLikesVersion } from '../api/library';
import { rowFromTrack, type RowTrack, type TrackLike } from '../api/normalize';
import { usePagingContinuation } from '../api/paging';
import type { Paging, UserProfile } from '../api/types';
import { EntityLayout, PageState } from '../components/EntityPage';
import { TrackList } from '../components/TrackList';
import { useHeaderColor } from '../lib/dominantColor';
import { plural } from '../lib/format';
import { play } from '../player/controls';
import { useAppearance } from '../store/appearance';

interface SavedTrack {
  added_at: string;
  track: TrackLike;
}

/**
 * Liked Songs (UI-SPEC §5.1/§5.2): GET /me/tracks (50 per page, loaded as you scroll).
 * Plays in the Liked Songs context (spotify:user:{id}:collection) from the chosen track.
 * Header colour is your accent (there is no cover to sample).
 */
export function LikedSongsPage() {
  const accent = useAppearance((s) => s.accent);
  const { data: me } = useApi<UserProfile>('/me');
  // Refetched (uncached) whenever you like/unlike anywhere in the app, so this list stays in
  // sync with the buttons in rows, the player bar and the Now Playing panel.
  const likesVersion = useLikesVersion();
  const { data: first, error } = useAsync<Paging<SavedTrack>>(() => api<Paging<SavedTrack>>('/me/tracks?limit=50'), [likesVersion]);
  const paged = usePagingContinuation<SavedTrack>(first);
  const rows = useMemo(
    () =>
      paged.items
        .map((s, i) => rowFromTrack(s.track, `${s.track?.uri}#${i}`, { addedAt: s.added_at }))
        .filter((r): r is RowTrack => r !== null),
    [paged.items],
  );
  const color = useHeaderColor(null, accent);
  const contextUri = me ? likedSongsUri(me.id) : undefined;

  const onPlay = useCallback(
    (row: RowTrack) => contextUri && void play({ contextUri, offsetUri: row.uri }),
    [contextUri],
  );

  if (!first) return <PageState error={error} what="Liked Songs list" />;

  return (
    <EntityLayout
      color={color}
      typeLabel="Playlist"
      title="Liked Songs"
      liked
      playTarget={contextUri && rows.length ? { contextUri } : undefined}
      meta={
        <>
          {me?.display_name && <span className="font-bold">{me.display_name}</span>}
          <span className="text-fg/80">· {plural(paged.total, 'song')}</span>
        </>
      }
    >
      {rows.length === 0 ? (
        <p className="py-8 text-fg-muted">Songs you like will appear here. Use the ⊕ button next to any song.</p>
      ) : (
        <TrackList
          label="Liked Songs"
          rows={rows}
          onPlay={onPlay}
          columns={{ cover: true, album: true, added: true }}
          totalCount={paged.total}
          hasMore={paged.hasMore}
          loadingMore={paged.loadingMore}
          onLoadMore={paged.loadMore}
        />
      )}
    </EntityLayout>
  );
}
