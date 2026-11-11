import { create } from 'zustand';
import { api } from '../api/client';
import { fetchAll } from '../api/paging';
import type { Artist, PlaylistSimplified, SavedAlbum, SavedShow, SpotifyImage } from '../api/types';
import { useAuth } from '../auth/authStore';

export type LibraryKind = 'playlist' | 'album' | 'artist' | 'show';

export interface LibraryEntry {
  id: string;
  uri: string;
  kind: LibraryKind;
  name: string;
  /** Owner / artist / publisher, used for the "Creator" sort and the subtitle. */
  creator: string;
  images: SpotifyImage[] | null;
  /** When it was saved, where the API tells us (albums, shows). */
  addedAt: string | null;
  /** Position in its source list (API order). */
  order: number;
  to: string;
}

interface LibraryState {
  entries: LibraryEntry[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  /** Sources that failed to load (shown as a hint, the rest still works). */
  failed: string[];
  likedTotal: number | null;
}

export const useLibrary = create<LibraryState>()(() => ({
  entries: [],
  status: 'idle',
  failed: [],
  likedTotal: null,
}));

// Generous caps (chosen) so a huge library can't stall the sidebar.
const MAX_PER_KIND = 1000;

interface FollowingPage {
  artists: { items: Artist[]; next: string | null };
}

async function fetchFollowedArtists(): Promise<Artist[]> {
  const out: Artist[] = [];
  let next: string | null = '/me/following?type=artist&limit=50';
  while (next && out.length < MAX_PER_KIND) {
    const page: FollowingPage = await api<FollowingPage>(next);
    out.push(...page.artists.items);
    next = page.artists.next;
  }
  return out;
}

let loading: Promise<void> | null = null;

/**
 * Loads Your Library for the sidebar (UI-SPEC §5.2), each source independently:
 *   GET /me/playlists, /me/albums, /me/following?type=artist, /me/shows, /me/tracks?limit=1 (count)
 * Folders and pins have no official API and are not shown.
 */
export function loadLibrary(force = false): Promise<void> {
  const { status } = useLibrary.getState();
  if (loading) return loading;
  if (!force && (status === 'ready' || status === 'loading')) return Promise.resolve();
  if (!force || status !== 'ready') useLibrary.setState({ status: 'loading' });

  loading = (async () => {
    const [playlists, albums, artists, shows, liked] = await Promise.allSettled([
      fetchAll<PlaylistSimplified>('/me/playlists?limit=50', MAX_PER_KIND),
      fetchAll<SavedAlbum>('/me/albums?limit=50', MAX_PER_KIND),
      fetchFollowedArtists(),
      fetchAll<SavedShow>('/me/shows?limit=50', MAX_PER_KIND),
      api<{ total: number }>('/me/tracks?limit=1'),
    ]);

    const entries: LibraryEntry[] = [];
    const failed: string[] = [];
    const take = <T>(r: PromiseSettledResult<T>, label: string): T | null => {
      if (r.status === 'fulfilled') return r.value;
      console.warn(`[library] ${label} failed:`, r.reason);
      failed.push(label);
      return null;
    };

    take(playlists, 'playlists')?.forEach((p, order) => {
      if (!p) return;
      entries.push({
        id: p.id, uri: p.uri, kind: 'playlist', name: p.name, creator: p.owner.display_name ?? p.owner.id,
        images: p.images, addedAt: null, order, to: `/playlist/${p.id}`,
      });
    });
    take(albums, 'albums')?.forEach(({ album: a, added_at }, order) => {
      entries.push({
        id: a.id, uri: a.uri, kind: 'album', name: a.name, creator: a.artists.map((x) => x.name).join(', '),
        images: a.images, addedAt: added_at, order, to: `/album/${a.id}`,
      });
    });
    take(artists, 'artists')?.forEach((a, order) => {
      entries.push({
        id: a.id, uri: a.uri, kind: 'artist', name: a.name, creator: a.name,
        images: a.images, addedAt: null, order, to: `/artist/${a.id}`,
      });
    });
    take(shows, 'podcasts')?.forEach(({ show: s, added_at }, order) => {
      entries.push({
        id: s.id, uri: s.uri, kind: 'show', name: s.name, creator: s.publisher,
        images: s.images, addedAt: added_at, order, to: `/show/${s.id}`,
      });
    });
    const likedRes = take(liked, 'liked songs');

    useLibrary.setState({
      entries,
      failed,
      likedTotal: likedRes?.total ?? null,
      status: failed.length === 5 ? 'error' : 'ready',
    });
  })().finally(() => {
    loading = null;
  });
  return loading;
}

export type LibrarySort = 'recent' | 'alpha' | 'creator';

const KIND_RANK: Record<LibraryKind, number> = { playlist: 0, album: 1, show: 1, artist: 2 };

/**
 * Sorting. "Recently added": the API has no saved date for playlists or followed artists
 * (spec §5.2 ⚠️), so playlists come first in the API's own order (Spotify returns them
 * most-recent first), then albums and shows by saved date, then artists in API order.
 */
export function sortEntries(entries: LibraryEntry[], sort: LibrarySort): LibraryEntry[] {
  const copy = [...entries];
  const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
  if (sort === 'alpha') return copy.sort((a, b) => collator.compare(a.name, b.name));
  if (sort === 'creator') return copy.sort((a, b) => collator.compare(a.creator, b.creator) || collator.compare(a.name, b.name));
  return copy.sort((a, b) => {
    const rank = KIND_RANK[a.kind] - KIND_RANK[b.kind];
    if (rank !== 0) return rank;
    if (a.addedAt && b.addedAt) return b.addedAt.localeCompare(a.addedAt);
    return a.order - b.order;
  });
}

useAuth.subscribe((s, prev) => {
  if (prev.refreshToken && !s.refreshToken) {
    useLibrary.setState({ entries: [], status: 'idle', failed: [], likedTotal: null });
  }
});
