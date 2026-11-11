// Subsets of official Web API objects. Only fields the UI uses are typed.

export interface SpotifyImage {
  url: string;
  width: number | null;
  height: number | null;
}

export interface Paging<T> {
  href: string;
  items: T[];
  limit: number;
  next: string | null;
  offset: number;
  total: number;
}

export interface UserProfile {
  id: string;
  display_name: string | null;
  email?: string;
  country?: string;
  product?: 'premium' | 'free' | 'open' | string;
  images: SpotifyImage[];
  followers?: { total: number };
}

export interface ArtistSimplified {
  id: string;
  name: string;
  uri: string;
}

export interface Artist extends ArtistSimplified {
  images: SpotifyImage[];
  followers?: { total: number };
  genres?: string[];
}

export interface AlbumSimplified {
  id: string;
  name: string;
  uri: string;
  album_type: 'album' | 'single' | 'compilation' | string;
  images: SpotifyImage[];
  artists: ArtistSimplified[];
  release_date: string;
  total_tracks?: number;
}

export interface Track {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  explicit: boolean;
  album: AlbumSimplified;
  artists: ArtistSimplified[];
  is_local?: boolean;
}

export interface PlaylistSimplified {
  id: string;
  name: string;
  uri: string;
  description: string | null;
  /** May be null for playlists without artwork. */
  images: SpotifyImage[] | null;
  owner: { id: string; display_name: string | null };
}

export interface ShowSimplified {
  id: string;
  name: string;
  uri: string;
  publisher: string;
  images: SpotifyImage[];
}

export interface PlayHistory {
  track: Track;
  played_at: string;
  context: { type: string; uri: string; href: string | null } | null;
}

export interface CursorPaging<T> {
  items: T[];
  next: string | null;
  limit: number;
}

export interface SavedAlbum {
  added_at: string;
  album: AlbumSimplified;
}

export interface SavedShow {
  added_at: string;
  show: ShowSimplified;
}
