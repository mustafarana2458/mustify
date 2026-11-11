import { routeForUri } from '../lib/routes';
import { cachedGet } from './hooks';
import type {
  Artist,
  CursorPaging,
  Paging,
  PlayHistory,
  PlaylistSimplified,
  ShowSimplified,
  SpotifyImage,
  Track,
} from './types';

/** What a play button should start. */
export interface PlayTarget {
  contextUri?: string;
  /** Track inside the context to start from. */
  offsetUri?: string;
  uris?: string[];
}

/** One tile in the quick-access grid / one card in a shelf. */
export interface HomeItem {
  key: string;
  title: string;
  subtitle?: string;
  images: SpotifyImage[] | null;
  to: string;
  round?: boolean;
  liked?: boolean;
  play?: PlayTarget;
}

const QUICK_ACCESS_COUNT = 8;
/** How many recent contexts to try resolving (some will fail). Chosen. */
const MAX_CONTEXT_LOOKUPS = 12;

export const likedSongsUri = (userId: string) => `spotify:user:${userId}:collection`;

/**
 * Quick-access grid (UI-SPEC §5.3, ⚠️ workaround). There is no official "recent contexts"
 * endpoint, so:
 *   1. de-duplicate recently-played tracks by the context they played in (most recent first)
 *   2. resolve each context's name/art:
 *        album      → from the track's own album (no request)
 *        collection → Liked Songs tile (no request)
 *        playlist   → GET /playlists/{id}   (fails for Spotify-owned/algorithmic playlists
 *                                            in new apps → skipped)
 *        artist     → GET /artists/{id}
 *        show       → GET /shows/{id}
 *   3. top up to 8 with, in order: Liked Songs, your playlists, albums of recent tracks.
 *
 * Phase 3 bug: step 3 used to try only your playlists, so a history made up of
 * restricted playlists could leave the grid empty. A summary is logged as "[home]".
 */
export async function loadQuickAccess(history: PlayHistory[], userId: string | undefined): Promise<HomeItem[]> {
  const seen = new Set<string>();
  const contexts: PlayHistory[] = [];
  let noContext = 0;
  for (const h of history) {
    if (!h.context?.uri) {
      noContext++;
      continue;
    }
    if (seen.has(h.context.uri)) continue;
    seen.add(h.context.uri);
    contexts.push(h);
  }

  const failed: { uri: string; reason: string }[] = [];
  const resolved = await Promise.all(
    contexts.slice(0, MAX_CONTEXT_LOOKUPS).map(async (h): Promise<HomeItem | null> => {
      const uri = h.context!.uri;
      const to = routeForUri(uri);
      if (!to) {
        failed.push({ uri, reason: 'unsupported context type' });
        return null;
      }
      const id = uri.split(':')[2];
      const play = { contextUri: uri };
      try {
        switch (h.context!.type) {
          case 'collection':
            return { key: uri, title: 'Liked Songs', images: null, to, liked: true, play };
          case 'album':
            return h.track?.album?.uri === uri
              ? { key: uri, title: h.track.album.name, images: h.track.album.images, to, play }
              : null;
          case 'playlist': {
            const p = await cachedGet<PlaylistSimplified>(`/playlists/${id}?fields=id,name,uri,images,owner(id,display_name)`);
            return { key: uri, title: p.name, images: p.images, to, play };
          }
          case 'artist': {
            const a = await cachedGet<Artist>(`/artists/${id}`);
            return { key: uri, title: a.name, images: a.images, to, round: true, play };
          }
          case 'show': {
            const s = await cachedGet<ShowSimplified>(`/shows/${id}`);
            return { key: uri, title: s.name, images: s.images, to, play };
          }
        }
        failed.push({ uri, reason: `unhandled type ${h.context!.type}` });
      } catch (e) {
        failed.push({ uri, reason: (e as Error).message });
      }
      return null;
    }),
  );

  const items = resolved.filter((x): x is HomeItem => x !== null).slice(0, QUICK_ACCESS_COUNT);
  const fromContexts = items.length;
  const add = (item: HomeItem) => {
    if (items.length < QUICK_ACCESS_COUNT && !items.some((i) => i.key === item.key)) items.push(item);
  };

  // Top-up 1: Liked Songs (always available).
  if (userId && !items.some((i) => i.liked)) {
    const uri = likedSongsUri(userId);
    add({ key: uri, title: 'Liked Songs', images: null, to: '/collection/tracks', liked: true, play: { contextUri: uri } });
  }
  // Top-up 2: your playlists.
  if (items.length < QUICK_ACCESS_COUNT) {
    const mine = await cachedGet<Paging<PlaylistSimplified>>('/me/playlists?limit=20').catch((e: Error) => {
      failed.push({ uri: '/me/playlists', reason: e.message });
      return null;
    });
    for (const p of mine?.items ?? []) {
      if (p) add({ key: p.uri, title: p.name, images: p.images, to: `/playlist/${p.id}`, play: { contextUri: p.uri } });
    }
  }
  // Top-up 3: albums of recently played tracks (needs no extra request).
  for (const h of history) {
    const a = h.track?.album;
    if (a?.uri) add({ key: a.uri, title: a.name, images: a.images, to: `/album/${a.id}`, play: { contextUri: a.uri } });
  }

  console.info('[home] quick access', {
    historyItems: history.length,
    withoutContext: noContext,
    uniqueContexts: contexts.length,
    resolvedFromContexts: fromContexts,
    tiles: items.length,
    failed,
  });
  return items;
}

export function getRecentlyPlayed() {
  return cachedGet<CursorPaging<PlayHistory>>('/me/player/recently-played?limit=50');
}

/** Recently played tracks, de-duplicated, shown as cards that open the track's album. */
export function recentTrackItems(history: PlayHistory[]): HomeItem[] {
  const seen = new Set<string>();
  const out: HomeItem[] = [];
  for (const { track } of history) {
    if (!track?.id || seen.has(track.id)) continue;
    seen.add(track.id);
    out.push(trackItem(track));
  }
  return out.slice(0, 20);
}

/** A track card opens its album; its play button plays the album starting at that track. */
export function trackItem(t: Track): HomeItem {
  return {
    key: t.uri,
    title: t.name,
    subtitle: t.artists.map((a) => a.name).join(', '),
    images: t.album.images,
    to: `/album/${t.album.id}`,
    play: { contextUri: t.album.uri, offsetUri: t.uri },
  };
}
