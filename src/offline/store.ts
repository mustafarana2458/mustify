import { create } from 'zustand';
import { toast } from '../store/toasts';
import {
  audioObjectUrl,
  coverObjectUrl,
  deleteTrack,
  listPlaylists,
  listTracks,
  removePlaylist,
  requestPersistence,
  savePlaylist,
  saveTrack,
  storageInfo,
  type StorageInfo,
} from './db';
import { parseTags } from './tags';
import type { DownloadSpec, OfflinePlaylist, Playable, TrackMeta } from './types';

export interface DownloadState {
  id: string;
  title: string;
  loaded: number;
  total: number;
  status: 'downloading' | 'saving' | 'error';
  error?: string;
}

interface OfflineState {
  loaded: boolean;
  tracks: TrackMeta[];
  playlists: OfflinePlaylist[];
  downloads: Record<string, DownloadState>;
  online: boolean;
  storage: StorageInfo | null;
}

export const useOffline = create<OfflineState>()(() => ({
  loaded: false,
  tracks: [],
  playlists: [],
  downloads: {},
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  storage: null,
}));

// ---------- network ----------

export function installNetworkListeners() {
  const update = () => useOffline.setState({ online: navigator.onLine });
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

// ---------- loading ----------

let loading: Promise<void> | null = null;

export function loadOffline(): Promise<void> {
  if (!loading) {
    loading = (async () => {
      try {
        const [tracks, playlists] = await Promise.all([listTracks(), listPlaylists()]);
        useOffline.setState({ tracks, playlists, loaded: true });
      } catch (e) {
        console.warn('[offline] could not load library', e);
        useOffline.setState({ loaded: true });
      }
      void refreshStorage();
    })();
  }
  return loading;
}

export async function refreshStorage() {
  useOffline.setState({ storage: await storageInfo().catch(() => null) });
}

/** Ask the browser to keep offline data (called on the first download/import). */
async function ensurePersisted() {
  const s = useOffline.getState().storage;
  if (s?.persisted) return;
  await requestPersistence();
  await refreshStorage();
}

export const isDownloaded = (id: string) => useOffline.getState().tracks.some((t) => t.id === id);

// ---------- playback helpers ----------

/** A stored track as something the audio engine can play (no network needed). */
export function playableFromMeta(m: TrackMeta): Playable {
  return {
    id: m.id,
    source: m.source,
    title: m.title,
    artist: m.artist,
    album: m.album,
    durationMs: m.durationMs,
    attribution: m.attribution,
    coverUrl: m.hasCover ? undefined : m.coverRemote,
    getCover: m.hasCover ? () => coverObjectUrl(m.id) : undefined,
    getAudioUrl: () => audioObjectUrl(m.id),
  };
}

/** Prefer the downloaded copy of an online result when there is one. */
export function preferDownloaded(p: Playable): Playable {
  const m = useOffline.getState().tracks.find((t) => t.id === p.id);
  return m ? playableFromMeta(m) : p;
}

// ---------- downloads ----------

const PROGRESS_EVERY_MS = 150; // throttle progress updates (chosen)

function setDownload(id: string, patch: Partial<DownloadState> | null) {
  useOffline.setState((s) => {
    const downloads = { ...s.downloads };
    if (patch === null) delete downloads[id];
    else downloads[id] = { ...(downloads[id] ?? { id, title: '', loaded: 0, total: 0, status: 'downloading' }), ...patch };
    return { downloads };
  });
}

async function fetchWithProgress(
  url: string,
  onProgress: (loaded: number, total: number) => void,
  mimeHint?: string,
): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}).`);
  // Trust the server's type only if it's actually audio (Jamendo labels MP3s as text/html,
  // and a blob typed text/html won't play on iOS).
  const served = res.headers.get('Content-Type') ?? '';
  const type = /^audio\//i.test(served) ? served.split(';')[0] : (mimeHint ?? 'audio/mpeg');
  const total = Number(res.headers.get('Content-Length')) || 0;
  if (!res.body) return new Blob([await res.arrayBuffer()], { type });
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  let last = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    const now = Date.now();
    if (now - last > PROGRESS_EVERY_MS) {
      last = now;
      onProgress(loaded, total);
    }
  }
  onProgress(loaded, total || loaded);
  return new Blob(chunks as BlobPart[], { type });
}

async function fetchCover(url: string | undefined): Promise<Blob | null> {
  if (!url) return null;
  try {
    const r = await fetch(url);
    return r.ok ? await r.blob() : null;
  } catch {
    return null; // CORS or network: keep the remote URL as a fallback
  }
}

/** Saves a Jamendo/Audius track for offline playback, with progress. */
export async function downloadTrack(spec: DownloadSpec): Promise<void> {
  const id = `${spec.source}:${spec.sourceId}`;
  if (isDownloaded(id) || useOffline.getState().downloads[id]?.status === 'downloading') return;
  setDownload(id, { id, title: spec.title, loaded: 0, total: 0, status: 'downloading', error: undefined });
  try {
    const [audio, cover] = await Promise.all([
      fetchWithProgress(spec.audioUrl, (loaded, total) => setDownload(id, { loaded, total }), spec.mime),
      fetchCover(spec.coverUrl),
    ]);
    setDownload(id, { status: 'saving' });
    const meta: TrackMeta = {
      id,
      source: spec.source,
      sourceId: spec.sourceId,
      title: spec.title,
      artist: spec.artist,
      album: spec.album,
      durationMs: spec.durationMs,
      attribution: spec.attribution,
      mime: audio.type || 'audio/mpeg',
      size: audio.size,
      hasCover: !!cover,
      coverRemote: cover ? undefined : spec.coverUrl,
      addedAt: Date.now(),
    };
    await saveTrack(meta, audio, cover);
    useOffline.setState((s) => ({ tracks: [...s.tracks, meta] }));
    setDownload(id, null);
    void ensurePersisted();
  } catch (e) {
    const msg =
      e instanceof TypeError
        ? "This source didn't allow the download from the browser (network/CORS)."
        : (e as Error).message || 'Download failed.';
    setDownload(id, { status: 'error', error: msg });
    toast(`Couldn't save “${spec.title}”: ${msg}`);
  }
}

export const clearDownloadError = (id: string) => setDownload(id, null);

// ---------- import ----------

const AUDIO_EXT = /\.(mp3|m4a|aac|mp4)$/i;
const MIME_BY_EXT: Record<string, string> = { mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac' };

export const isImportable = (f: File) => /^audio\/(mpeg|mp3|mp4|x-m4a|aac|aacp)$/.test(f.type) || AUDIO_EXT.test(f.name);

/** Reads the duration with an off-screen <audio> (0 if the browser can't tell). */
function probeDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const a = new Audio();
    const done = (ms: number) => {
      URL.revokeObjectURL(url);
      a.removeAttribute('src');
      resolve(ms);
    };
    const t = window.setTimeout(() => done(0), 8000);
    a.preload = 'metadata';
    a.onloadedmetadata = () => {
      window.clearTimeout(t);
      done(Number.isFinite(a.duration) ? Math.round(a.duration * 1000) : 0);
    };
    a.onerror = () => {
      window.clearTimeout(t);
      done(0);
    };
    a.src = url;
  });
}

export interface ImportResult {
  imported: number;
  skipped: string[];
}

/** Imports your own MP3/M4A/AAC files (title/artist/album/cover from their tags). */
export async function importFiles(files: File[], onProgress?: (done: number, total: number) => void): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: [] };
  let done = 0;
  for (const file of files) {
    try {
      if (!isImportable(file)) {
        result.skipped.push(`${file.name} (not an MP3/M4A/AAC file)`);
        continue;
      }
      const tags = parseTags(await file.arrayBuffer());
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      const mime = file.type || MIME_BY_EXT[ext] || 'audio/mpeg';
      const cover = tags.cover ? new Blob([tags.cover.data as BlobPart], { type: tags.cover.mime }) : null;
      const sourceId = crypto.randomUUID();
      const meta: TrackMeta = {
        id: `local:${sourceId}`,
        source: 'local',
        sourceId,
        title: tags.title || file.name.replace(/\.[^.]+$/, ''),
        artist: tags.artist || 'Unknown artist',
        album: tags.album,
        durationMs: await probeDuration(file),
        attribution: { text: 'Imported from your device' },
        mime,
        size: file.size,
        hasCover: !!cover,
        addedAt: Date.now(),
      };
      await saveTrack(meta, new Blob([file], { type: mime }), cover);
      useOffline.setState((s) => ({ tracks: [...s.tracks, meta] }));
      result.imported++;
    } catch (e) {
      result.skipped.push(`${file.name} (${(e as Error).message || 'could not be saved'})`);
    } finally {
      onProgress?.(++done, files.length);
    }
  }
  if (result.imported) void ensurePersisted();
  void refreshStorage();
  return result;
}

// ---------- delete ----------

export async function removeTrack(id: string) {
  await deleteTrack(id);
  useOffline.setState((s) => ({ tracks: s.tracks.filter((t) => t.id !== id) }));
  // Drop it from offline playlists too.
  for (const p of useOffline.getState().playlists) {
    if (p.trackIds.includes(id)) await updatePlaylist(p.id, { trackIds: p.trackIds.filter((t) => t !== id) });
  }
  void refreshStorage();
}

// ---------- playlists ----------

export async function createPlaylist(name: string): Promise<OfflinePlaylist> {
  const now = Date.now();
  const p: OfflinePlaylist = { id: crypto.randomUUID(), name: name.trim() || 'New playlist', trackIds: [], createdAt: now, updatedAt: now };
  await savePlaylist(p);
  useOffline.setState((s) => ({ playlists: [...s.playlists, p] }));
  return p;
}

export async function updatePlaylist(id: string, patch: Partial<Pick<OfflinePlaylist, 'name' | 'trackIds'>>) {
  const current = useOffline.getState().playlists.find((p) => p.id === id);
  if (!current) return;
  const next = { ...current, ...patch, updatedAt: Date.now() };
  await savePlaylist(next);
  useOffline.setState((s) => ({ playlists: s.playlists.map((p) => (p.id === id ? next : p)) }));
}

export async function deletePlaylist(id: string) {
  await removePlaylist(id);
  useOffline.setState((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) }));
}

export async function addToPlaylist(playlistId: string, trackId: string) {
  const p = useOffline.getState().playlists.find((x) => x.id === playlistId);
  if (!p) return;
  if (p.trackIds.includes(trackId)) {
    toast(`Already in “${p.name}”.`);
    return;
  }
  await updatePlaylist(playlistId, { trackIds: [...p.trackIds, trackId] });
  toast(`Added to “${p.name}”.`);
}
