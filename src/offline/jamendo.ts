import type { Attribution, DownloadSpec, License, Playable } from './types';

/*
 * Jamendo API v3 (https://developer.jamendo.com/v3.0). Creative Commons music.
 * Client id from VITE_JAMENDO_CLIENT_ID. Downloads are offered ONLY when the track's
 * `audiodownload_allowed` is true; every track carries its CC licence + artist attribution.
 */

const BASE = 'https://api.jamendo.com/v3.0';
export const JAMENDO_CLIENT_ID: string = import.meta.env.VITE_JAMENDO_CLIENT_ID ?? '';
export const jamendoConfigured = () => JAMENDO_CLIENT_ID.length > 0;

export const PAGE_SIZE = 30;

export interface JTrack {
  id: string;
  name: string;
  duration: number;
  artist_id: string;
  artist_name: string;
  album_id: string;
  album_name: string;
  album_image: string;
  image: string;
  audio: string;
  audiodownload: string;
  audiodownload_allowed: boolean;
  license_ccurl: string;
  shareurl: string;
}

export interface JAlbum {
  id: string;
  name: string;
  artist_name: string;
  image: string;
  releasedate: string;
}

export interface JArtist {
  id: string;
  name: string;
  image: string;
}

interface JResponse<T> {
  headers: { status: string; code: number; error_message?: string; results_count: number; next?: string };
  results: T[];
}

async function jget<T>(path: string, params: Record<string, string | number | undefined>): Promise<JResponse<T>> {
  const q = new URLSearchParams({ client_id: JAMENDO_CLIENT_ID, format: 'json' });
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  const res = await fetch(`${BASE}${path}?${q}`);
  if (!res.ok) throw new Error(`Jamendo: ${res.status} ${res.statusText}`);
  const json = (await res.json()) as JResponse<T>;
  if (json.headers.status !== 'success') throw new Error(`Jamendo: ${json.headers.error_message || 'request failed'}`);
  return json;
}

const TRACK_PARAMS = { audioformat: 'mp32', audiodlformat: 'mp32', imagesize: 300, include: 'licenses' };

export interface TrackQuery {
  search?: string;
  tags?: string;
  albumId?: string;
  artistId?: string;
  order?: string;
  offset?: number;
}

export async function jamendoTracks(q: TrackQuery): Promise<JTrack[]> {
  const r = await jget<JTrack>('/tracks/', {
    ...TRACK_PARAMS,
    limit: PAGE_SIZE,
    offset: q.offset ?? 0,
    search: q.search,
    fuzzytags: q.tags,
    album_id: q.albumId,
    artist_id: q.artistId,
    order: q.order ?? (q.albumId ? 'position' : q.search ? 'relevance' : 'popularity_week'),
  });
  return r.results;
}

export async function jamendoAlbums(search: string, offset = 0): Promise<JAlbum[]> {
  const r = await jget<JAlbum>('/albums/', {
    limit: PAGE_SIZE,
    offset,
    imagesize: 300,
    ...(search ? { search } : { order: 'popularity_week' }),
  });
  return r.results;
}

export async function jamendoArtists(search: string, offset = 0): Promise<JArtist[]> {
  const r = await jget<JArtist>('/artists/', {
    limit: PAGE_SIZE,
    offset,
    ...(search ? { search } : { order: 'popularity_week' }),
  });
  return r.results.map((a) => ({ ...a, image: a.image || '' }));
}

/** "http://creativecommons.org/licenses/by-nc-sa/3.0/" → "CC BY-NC-SA 3.0". */
export function licenseFromUrl(url: string): License | undefined {
  if (!url) return undefined;
  const m = url.match(/licenses\/([a-z-]+)\/([\d.]+)/i);
  const name = m ? `CC ${m[1].toUpperCase()} ${m[2]}` : 'Creative Commons';
  return { name, url };
}

export function jamendoAttribution(t: JTrack): Attribution {
  return { text: `by ${t.artist_name} on Jamendo`, url: t.shareurl, license: licenseFromUrl(t.license_ccurl) };
}

export const jamendoId = (t: JTrack) => `jamendo:${t.id}`;
const cover = (t: JTrack) => t.album_image || t.image || undefined;

/** Download spec, or null when the artist/licence doesn't allow downloads. */
export function jamendoDownloadSpec(t: JTrack): DownloadSpec | null {
  if (!t.audiodownload_allowed || !t.audiodownload) return null;
  return {
    source: 'jamendo',
    sourceId: t.id,
    title: t.name,
    artist: t.artist_name,
    album: t.album_name || undefined,
    durationMs: t.duration * 1000,
    attribution: jamendoAttribution(t),
    audioUrl: t.audiodownload,
    coverUrl: cover(t),
  };
}

/** Streams online (or plays the downloaded copy if present, see store.playableFor). */
export function jamendoPlayable(t: JTrack): Playable {
  return {
    id: jamendoId(t),
    source: 'jamendo',
    title: t.name,
    artist: t.artist_name,
    album: t.album_name || undefined,
    durationMs: t.duration * 1000,
    attribution: jamendoAttribution(t),
    coverUrl: cover(t),
    getAudioUrl: async () => t.audio,
  };
}

/** Genre chips (Jamendo tags). */
export const JAMENDO_GENRES = ['pop', 'rock', 'electronic', 'hiphop', 'jazz', 'classical', 'ambient', 'lounge', 'metal', 'folk', 'soundtrack', 'world'];
