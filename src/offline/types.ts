// Offline section types. Spotify content is never stored; these are Jamendo (Creative
// Commons, download-allowed only), Audius (artist-enabled downloads only) and your own files.

export type OfflineSource = 'jamendo' | 'audius' | 'local';

export interface License {
  /** e.g. "CC BY-SA 3.0" */
  name: string;
  url: string;
}

/** Who made it and under what terms; shown on every track row and in Now Playing. */
export interface Attribution {
  /** e.g. "by Artist on Jamendo" */
  text: string;
  /** The track's page at the source (Jamendo share URL / Audius permalink). */
  url?: string;
  license?: License;
}

/** A downloaded or imported track (metadata in IndexedDB; audio + cover in Cache Storage). */
export interface TrackMeta {
  /** `${source}:${sourceId}` */
  id: string;
  source: OfflineSource;
  sourceId: string;
  title: string;
  artist: string;
  album?: string;
  durationMs: number;
  attribution?: Attribution;
  mime: string;
  /** Audio size in bytes. */
  size: number;
  hasCover: boolean;
  /** Remote cover to fall back on (online only) if the cover couldn't be stored. */
  coverRemote?: string;
  addedAt: number;
}

export interface OfflinePlaylist {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
}

/** Anything the in-app audio engine can play: a downloaded file or an online stream. */
export interface Playable {
  id: string;
  source: OfflineSource;
  title: string;
  artist: string;
  album?: string;
  durationMs: number;
  attribution?: Attribution;
  /** Cover URL available right away (remote), or… */
  coverUrl?: string;
  /** …loaded on demand (stored cover → blob URL). */
  getCover?: () => Promise<string | undefined>;
  /** Resolves the audio URL (blob URL for stored audio, https URL for streams). */
  getAudioUrl: () => Promise<string>;
}

/** What's needed to save a Jamendo/Audius track offline. */
export interface DownloadSpec {
  source: Exclude<OfflineSource, 'local'>;
  sourceId: string;
  title: string;
  artist: string;
  album?: string;
  durationMs: number;
  attribution?: Attribution;
  audioUrl: string;
  coverUrl?: string;
}

/** Player URI for an offline-section track (same for its stream and its download). */
export const offlineUri = (id: string) => `mustify:${id}`;
