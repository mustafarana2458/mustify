import type { HomeItem } from './home';
import type { AlbumSimplified, Artist, PlaylistSimplified, SavedShow, ShowSimplified } from './types';

// Map Web API objects to card items (shared by Home, Search, Album and Artist pages).

export const artistItem = (a: Artist): HomeItem => ({
  key: a.uri,
  title: a.name,
  subtitle: 'Artist',
  images: a.images,
  to: `/artist/${a.id}`,
  round: true,
  play: { contextUri: a.uri },
});

const ALBUM_TYPE: Record<string, string> = { album: 'Album', single: 'Single', compilation: 'Compilation' };

export const albumItem = (a: AlbumSimplified, subtitle: 'artists' | 'year-type' = 'artists'): HomeItem => ({
  key: a.uri,
  title: a.name,
  subtitle:
    subtitle === 'artists'
      ? a.artists.map((x) => x.name).join(', ')
      : `${a.release_date?.slice(0, 4) ?? ''} · ${ALBUM_TYPE[a.album_type] ?? 'Album'}`,
  images: a.images,
  to: `/album/${a.id}`,
  play: { contextUri: a.uri },
});

export const playlistItem = (p: PlaylistSimplified): HomeItem => ({
  key: p.uri,
  title: p.name,
  subtitle: `By ${p.owner.display_name ?? p.owner.id}`,
  images: p.images,
  to: `/playlist/${p.id}`,
  play: { contextUri: p.uri },
});

export const showItem = (s: ShowSimplified): HomeItem => ({
  key: s.uri,
  title: s.name,
  subtitle: s.publisher,
  images: s.images,
  to: `/show/${s.id}`,
  play: { contextUri: s.uri },
});

export const savedShowItem = (s: SavedShow): HomeItem => showItem(s.show);
