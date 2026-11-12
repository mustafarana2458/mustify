import { APP_NAME } from '../brand/info';
import type { Attribution, DownloadSpec, Playable } from './types';

/*
 * Audius API (https://docs.audius.org), no key; every request sends app_name=Mustify.
 * Streaming is offered when the track is streamable and not gated; saving offline ONLY when
 * the artist has made the track downloadable (is_downloadable). The download endpoint returns
 * the artist's own downloadable file.
 */

const APP = APP_NAME;
let hostPromise: Promise<string> | null = null;

/** Audius asks clients to pick one of its discovery nodes. */
function host(): Promise<string> {
  if (!hostPromise) {
    hostPromise = fetch('https://api.audius.co')
      .then((r) => r.json() as Promise<{ data: string[] }>)
      .then((j) => j.data[Math.floor(Math.random() * j.data.length)] ?? 'https://discoveryprovider.audius.co')
      .catch(() => 'https://discoveryprovider.audius.co');
  }
  return hostPromise;
}

export interface ATrack {
  id: string;
  title: string;
  duration: number;
  genre?: string;
  permalink?: string;
  user: { name: string; handle: string };
  artwork?: { '150x150'?: string; '480x480'?: string; '1000x1000'?: string } | null;
  is_streamable?: boolean;
  is_stream_gated?: boolean;
  is_downloadable?: boolean;
  is_download_gated?: boolean;
  downloadable?: boolean;
  download?: { is_downloadable?: boolean } | null;
}

async function aget<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const base = await host();
  const q = new URLSearchParams({ app_name: APP, ...params });
  const res = await fetch(`${base}/v1${path}?${q}`);
  if (!res.ok) throw new Error(`Audius: ${res.status} ${res.statusText}`);
  return ((await res.json()) as { data: T }).data;
}

export const audiusSearch = (query: string) => aget<ATrack[]>('/tracks/search', { query });
export const audiusTrending = (genre?: string) => aget<ATrack[]>('/tracks/trending', genre ? { time: 'week', genre } : { time: 'week' });

export const audiusId = (t: ATrack) => `audius:${t.id}`;

export const audiusStreamable = (t: ATrack) => t.is_streamable !== false && !t.is_stream_gated;
export const audiusDownloadable = (t: ATrack) =>
  !t.is_download_gated && (t.is_downloadable ?? t.download?.is_downloadable ?? t.downloadable ?? false) === true;

function attribution(t: ATrack): Attribution {
  return {
    text: `by ${t.user.name} on Audius`,
    url: t.permalink ? `https://audius.co${t.permalink}` : `https://audius.co/${t.user.handle}`,
  };
}

const cover = (t: ATrack) => t.artwork?.['480x480'] ?? t.artwork?.['150x150'] ?? undefined;

export function audiusPlayable(t: ATrack): Playable {
  return {
    id: audiusId(t),
    source: 'audius',
    title: t.title,
    artist: t.user.name,
    durationMs: t.duration * 1000,
    attribution: attribution(t),
    coverUrl: cover(t),
    getAudioUrl: async () => `${await host()}/v1/tracks/${encodeURIComponent(t.id)}/stream?app_name=${encodeURIComponent(APP)}`,
  };
}

export async function audiusDownloadSpec(t: ATrack): Promise<DownloadSpec | null> {
  if (!audiusDownloadable(t)) return null;
  return {
    source: 'audius',
    sourceId: t.id,
    title: t.title,
    artist: t.user.name,
    durationMs: t.duration * 1000,
    attribution: attribution(t),
    audioUrl: `${await host()}/v1/tracks/${encodeURIComponent(t.id)}/download?app_name=${encodeURIComponent(APP)}`,
    coverUrl: cover(t),
  };
}

export const AUDIUS_GENRES = ['Electronic', 'Hip-Hop/Rap', 'Pop', 'Rock', 'Alternative', 'Lo-Fi', 'Ambient', 'R&B/Soul'];
