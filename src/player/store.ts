import { create } from 'zustand';
import type { SpotifyImage } from '../api/types';
import { shouldUseRemoteMode } from './env';

export type RepeatMode = 'off' | 'context' | 'track';

/** Normalised "what's playing", built from either the Web API or the SDK. */
export interface PlaybackItem {
  /** Library id (for like/save). Null for local files / ads. */
  id: string | null;
  uri: string;
  name: string;
  durationMs: number;
  /** 'local' = Offline section (Jamendo / Audius / your files), played by the in-app engine. */
  kind: 'track' | 'episode' | 'local';
  album: { id: string | null; uri: string; name: string; images: SpotifyImage[] };
  artists: { id: string | null; uri: string; name: string }[];
  /** Offline-section tracks: source, licence and link (shown in Now Playing). */
  attribution?: import('../offline/types').Attribution;
}

export interface Device {
  id: string | null;
  name: string;
  type: string;
  is_active: boolean;
  volume_percent: number | null;
  supports_volume: boolean;
  is_restricted?: boolean;
}

export interface PlayerState {
  /**
   * Which engine drives the player UI: Spotify (SDK / Connect) or the in-app <audio> engine
   * for the Offline section. Only one plays at a time.
   */
  engine: 'spotify' | 'local';
  /** 'sdk': this browser can play audio. 'remote': Spotify Connect remote only. */
  mode: 'sdk' | 'remote';
  sdkStatus: 'idle' | 'loading' | 'ready' | 'error';
  sdkError: string | null;
  sdkDeviceId: string | null;

  device: Device | null;
  devices: Device[];

  item: PlaybackItem | null;
  contextUri: string | null;
  isPlaying: boolean;
  /** Position at `updatedAt` (epoch ms); interpolate while playing. */
  positionMs: number;
  updatedAt: number;
  shuffle: boolean;
  repeat: RepeatMode;
  /** 0..1 */
  volume: number;
  /** Volume to restore when un-muting. */
  volumeBeforeMute: number | null;
  queue: PlaybackItem[];

  /** Remote mode: retrying the device list (e.g. waiting for the Spotify app to wake up). */
  searchingDevices: boolean;
  /** The "open Spotify on this phone" banner is on screen (so we don't also toast it). */
  deviceHintVisible: boolean;
  /**
   * Phone: you pressed play / "Play here" but this phone's Spotify app isn't available, so
   * the "Open Spotify" hint is shown (instead of falling back to a computer).
   */
  phoneDeviceMissing: boolean;

  /** Bumped by every command / SDK event so stale polls can be discarded. */
  seq: number;
}

export const usePlayer = create<PlayerState>()(() => ({
  engine: 'spotify',
  mode: shouldUseRemoteMode() ? 'remote' : 'sdk',
  sdkStatus: 'idle',
  sdkError: null,
  sdkDeviceId: null,
  device: null,
  devices: [],
  item: null,
  contextUri: null,
  isPlaying: false,
  positionMs: 0,
  updatedAt: Date.now(),
  shuffle: false,
  repeat: 'off',
  volume: 0.7,
  volumeBeforeMute: null,
  queue: [],
  searchingDevices: false,
  deviceHintVisible: false,
  phoneDeviceMissing: false,
  seq: 0,
}));

/** True when this browser tab is the active Spotify Connect device. */
export const selectIsLocal = (s: PlayerState) =>
  s.engine === 'spotify' && s.mode === 'sdk' && s.sdkDeviceId !== null && s.device?.id === s.sdkDeviceId;

/** True when audio is playing inside this page (Spotify SDK here, or the Offline engine). */
export const selectPlaysHere = (s: PlayerState) => s.engine === 'local' || selectIsLocal(s);

/** Name of the active device when it is some other device (for the "Playing on …" strip). */

export function currentPositionMs(s: PlayerState = usePlayer.getState()): number {
  const elapsed = s.isPlaying ? Date.now() - s.updatedAt : 0;
  return Math.max(0, Math.min(s.item?.durationMs ?? 0, s.positionMs + elapsed));
}

const idFromUri = (uri: string | null | undefined) => (uri ? (uri.split(':')[2] ?? null) : null);

// ---------- mapping from Web API objects ----------

interface ApiTrackLike {
  id: string | null;
  uri: string;
  name: string;
  duration_ms: number;
  type?: string;
  album?: { id: string; uri: string; name: string; images: SpotifyImage[] };
  artists?: { id: string; uri: string; name: string }[];
  // episodes
  images?: SpotifyImage[];
  show?: { id: string; uri: string; name: string; publisher: string; images: SpotifyImage[] };
}

export function itemFromApi(t: ApiTrackLike | null | undefined): PlaybackItem | null {
  if (!t) return null;
  if (t.type === 'episode' || t.show) {
    const show = t.show;
    return {
      id: t.id,
      uri: t.uri,
      name: t.name,
      durationMs: t.duration_ms,
      kind: 'episode',
      album: {
        id: show?.id ?? null,
        uri: show?.uri ?? '',
        name: show?.name ?? '',
        images: t.images?.length ? t.images : (show?.images ?? []),
      },
      artists: show ? [{ id: null, uri: show.uri, name: show.publisher || show.name }] : [],
    };
  }
  return {
    id: t.id,
    uri: t.uri,
    name: t.name,
    durationMs: t.duration_ms,
    kind: 'track',
    album: {
      id: t.album?.id ?? null,
      uri: t.album?.uri ?? '',
      name: t.album?.name ?? '',
      images: t.album?.images ?? [],
    },
    artists: (t.artists ?? []).map((a) => ({ id: a.id, uri: a.uri, name: a.name })),
  };
}

export function itemFromSdk(t: Spotify.Track | null): PlaybackItem | null {
  if (!t) return null;
  const isEpisode = t.type === 'episode';
  return {
    // Relinked tracks: the id you saved is the original one.
    id: t.linked_from?.id ?? t.id,
    uri: t.uri,
    name: t.name,
    durationMs: t.duration_ms,
    kind: isEpisode ? 'episode' : 'track',
    album: {
      id: idFromUri(t.album.uri),
      uri: t.album.uri,
      name: t.album.name,
      images: t.album.images.map((i) => ({ url: i.url, width: i.width ?? null, height: i.height ?? null })),
    },
    artists: t.artists.map((a) => ({ id: idFromUri(a.uri), uri: a.uri, name: a.name })),
  };
}
