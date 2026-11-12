import type { OfflinePlaylist, TrackMeta } from './types';

/*
 * Offline storage.
 *   IndexedDB "mustify-offline": track metadata + offline playlists (small, queryable).
 *   Cache Storage "mustify-offline-media": the audio and cover files themselves, keyed by
 *     same-origin URLs /offline-media/<id> and /offline-media/<id>/cover. The service worker
 *     serves that path from this cache (CacheOnly, with byte-range support), so the files are
 *     reachable with no internet. The player itself reads them straight from the cache
 *     (blob URLs), so it doesn't depend on the service worker either.
 * Nothing from Spotify is ever stored here.
 */

const DB_NAME = 'mustify-offline';
const DB_VERSION = 1;
export const MEDIA_CACHE = 'mustify-offline-media';
export const MEDIA_PREFIX = '/offline-media/';

const audioKey = (id: string) => `${MEDIA_PREFIX}${encodeURIComponent(id)}`;
const coverKey = (id: string) => `${MEDIA_PREFIX}${encodeURIComponent(id)}/cover`;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('tracks')) db.createObjectStore('tracks', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('playlists')) db.createObjectStore('playlists', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('Could not open offline storage.'));
    });
    dbPromise.catch(() => (dbPromise = null));
  }
  return dbPromise;
}

function run<T>(store: 'tracks' | 'playlists', mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = op(tx.objectStore(store));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error ?? req.error ?? new Error('Offline storage error.'));
        tx.onabort = () => reject(tx.error ?? new Error('Offline storage was aborted (storage full?).'));
      }),
  );
}

// ---------- tracks ----------

export const listTracks = () => run<TrackMeta[]>('tracks', 'readonly', (s) => s.getAll());

export async function saveTrack(meta: TrackMeta, audio: Blob, cover?: Blob | null): Promise<void> {
  const cache = await caches.open(MEDIA_CACHE);
  await cache.put(
    audioKey(meta.id),
    new Response(audio, { headers: { 'Content-Type': meta.mime, 'Content-Length': String(audio.size) } }),
  );
  if (cover) {
    await cache.put(coverKey(meta.id), new Response(cover, { headers: { 'Content-Type': cover.type || 'image/jpeg' } }));
  }
  await run('tracks', 'readwrite', (s) => s.put(meta));
}

export async function deleteTrack(id: string): Promise<void> {
  const cache = await caches.open(MEDIA_CACHE);
  await Promise.all([cache.delete(audioKey(id)), cache.delete(coverKey(id))]);
  await run('tracks', 'readwrite', (s) => s.delete(id));
  const url = coverUrls.get(id);
  coverUrls.delete(id);
  void url?.then((u) => u && URL.revokeObjectURL(u));
}

/** A blob: URL for a stored track's audio (caller revokes it when done). */
export async function audioObjectUrl(id: string): Promise<string> {
  const res = await (await caches.open(MEDIA_CACHE)).match(audioKey(id));
  if (!res) throw new Error('This download is missing. Delete it and download it again.');
  return URL.createObjectURL(await res.blob());
}

const coverUrls = new Map<string, Promise<string | undefined>>();

/** A blob: URL for a stored cover (kept for the session). */
export function coverObjectUrl(id: string): Promise<string | undefined> {
  let p = coverUrls.get(id);
  if (!p) {
    p = caches
      .open(MEDIA_CACHE)
      .then((c) => c.match(coverKey(id)))
      .then(async (r) => (r ? URL.createObjectURL(await r.blob()) : undefined))
      .catch(() => undefined);
    coverUrls.set(id, p);
  }
  return p;
}

// ---------- playlists ----------

export const listPlaylists = () => run<OfflinePlaylist[]>('playlists', 'readonly', (s) => s.getAll());
export const savePlaylist = (p: OfflinePlaylist) => run('playlists', 'readwrite', (s) => s.put(p)).then(() => undefined);
export const removePlaylist = (id: string) => run('playlists', 'readwrite', (s) => s.delete(id)).then(() => undefined);

// ---------- storage ----------

export interface StorageInfo {
  usage: number;
  quota: number;
  persisted: boolean;
}

export async function storageInfo(): Promise<StorageInfo | null> {
  if (!navigator.storage?.estimate) return null;
  const [{ usage = 0, quota = 0 }, persisted] = await Promise.all([
    navigator.storage.estimate(),
    navigator.storage.persisted?.() ?? Promise.resolve(false),
  ]);
  return { usage, quota, persisted };
}

/** Asks the browser not to evict offline data under storage pressure. */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
