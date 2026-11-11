import { useEffect, useState } from 'react';
import { loadLibrary } from '../store/library';
import { toast } from '../store/toasts';
import { api } from './client';
import { invalidateCache } from './hooks';

export type EntityKind = 'album' | 'artist' | 'playlist' | 'show';

/**
 * Save / follow state for whole entities (official Web API):
 *   album     GET /me/albums/contains        PUT|DELETE /me/albums?ids=
 *   show      GET /me/shows/contains         PUT|DELETE /me/shows?ids=
 *   artist    GET /me/following/contains     PUT|DELETE /me/following?type=artist&ids=
 *   playlist  GET /playlists/{id}/followers/contains   PUT|DELETE /playlists/{id}/followers
 * After a change the sidebar library is reloaded.
 */
const endpoints: Record<EntityKind, { check: (id: string) => string; write: (id: string) => string; libraryPrefix: string }> = {
  album: { check: (id) => `/me/albums/contains?ids=${id}`, write: (id) => `/me/albums?ids=${id}`, libraryPrefix: '/me/albums' },
  show: { check: (id) => `/me/shows/contains?ids=${id}`, write: (id) => `/me/shows?ids=${id}`, libraryPrefix: '/me/shows' },
  artist: {
    check: (id) => `/me/following/contains?type=artist&ids=${id}`,
    write: (id) => `/me/following?type=artist&ids=${id}`,
    libraryPrefix: '/me/following',
  },
  playlist: {
    check: (id) => `/playlists/${id}/followers/contains`,
    write: (id) => `/playlists/${id}/followers`,
    libraryPrefix: '/me/playlists',
  },
};

const MESSAGES: Record<EntityKind, [string, string]> = {
  album: ['Saved to Your Library.', 'Removed from Your Library.'],
  show: ['Saved to Your Library.', 'Removed from Your Library.'],
  artist: ['Following.', 'Unfollowed.'],
  playlist: ['Saved to Your Library.', 'Removed from Your Library.'],
};

export function useEntitySaved(kind: EntityKind, id: string | undefined): [boolean | 'error' | undefined, () => void] {
  const [saved, setSaved] = useState<boolean | 'error' | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setSaved(undefined);
    api<boolean[]>(endpoints[kind].check(id))
      .then((r) => !cancelled && setSaved(!!r?.[0]))
      .catch((e) => {
        console.warn(`[saved] ${kind} contains failed`, e);
        if (!cancelled) setSaved('error');
      });
    return () => {
      cancelled = true;
    };
  }, [kind, id]);

  const toggle = () => {
    if (!id || typeof saved !== 'boolean') return;
    const next = !saved;
    setSaved(next);
    api(endpoints[kind].write(id), { method: next ? 'PUT' : 'DELETE' })
      .then(() => {
        toast(MESSAGES[kind][next ? 0 : 1]);
        invalidateCache(endpoints[kind].libraryPrefix);
        void loadLibrary(true);
      })
      .catch((e: Error) => {
        setSaved(saved);
        toast(`Couldn't update your library: ${e.message}`);
      });
  };

  return [saved, toggle];
}
