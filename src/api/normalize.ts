import type { AlbumSimplified, SpotifyImage } from './types';

/** One row in any track list (tracks and podcast episodes), whatever endpoint it came from. */
export interface RowTrack {
  /** Unique within the list (playlists can contain the same track twice). */
  key: string;
  id: string | null;
  uri: string;
  name: string;
  durationMs: number;
  explicit: boolean;
  kind: 'track' | 'episode';
  artists: { id: string | null; uri: string; name: string }[];
  album: { id: string | null; uri: string; name: string; images: SpotifyImage[] } | null;
  addedAt: string | null;
  isLocal: boolean;
  playable: boolean;
  /** Position in the source context (for "play from here" offsets). */
  position?: number;
}

/** Loose shape covering Web API track, simplified track and episode objects. */
export interface TrackLike {
  id: string | null;
  uri: string;
  name: string;
  duration_ms: number;
  explicit?: boolean;
  type?: string;
  is_local?: boolean;
  is_playable?: boolean;
  artists?: { id: string | null; uri: string; name: string }[];
  album?: AlbumSimplified;
  images?: SpotifyImage[];
  show?: { id: string; uri: string; name: string; publisher: string; images: SpotifyImage[] };
}

export function rowFromTrack(
  t: TrackLike | null | undefined,
  key: string,
  opts: { addedAt?: string | null; album?: AlbumSimplified } = {},
): RowTrack | null {
  if (!t || !t.uri) return null;
  const album = opts.album ?? t.album;
  if (t.type === 'episode' || t.show) {
    return {
      key,
      id: t.id,
      uri: t.uri,
      name: t.name,
      durationMs: t.duration_ms,
      explicit: !!t.explicit,
      kind: 'episode',
      artists: t.show ? [{ id: null, uri: t.show.uri, name: t.show.publisher || t.show.name }] : [],
      album: t.show
        ? { id: t.show.id, uri: t.show.uri, name: t.show.name, images: t.images?.length ? t.images : t.show.images }
        : null,
      addedAt: opts.addedAt ?? null,
      isLocal: false,
      playable: t.is_playable !== false,
    };
  }
  return {
    key,
    id: t.is_local ? null : t.id,
    uri: t.uri,
    name: t.name,
    durationMs: t.duration_ms,
    explicit: !!t.explicit,
    kind: 'track',
    artists: (t.artists ?? []).map((a) => ({ id: a.id, uri: a.uri, name: a.name })),
    album: album ? { id: album.id ?? null, uri: album.uri, name: album.name, images: album.images ?? [] } : null,
    addedAt: opts.addedAt ?? null,
    isLocal: !!t.is_local,
    playable: t.is_playable !== false && !t.is_local,
  };
}

/** Playlist entries: newer API responses may use `item` instead of `track`. */
export interface PlaylistEntry {
  added_at: string | null;
  track?: TrackLike | null;
  item?: TrackLike | null;
}

export function rowFromPlaylistEntry(e: PlaylistEntry, index: number): RowTrack | null {
  const t = e.track ?? e.item;
  const row = rowFromTrack(t, `${t?.uri ?? 'x'}#${index}`, { addedAt: e.added_at });
  return row ? { ...row, position: index } : null;
}
