// Minimal hand-written types for the official Web Playback SDK (https://sdk.scdn.co/spotify-player.js).
// Only the members this app uses. Audio/DRM is handled entirely inside the SDK and the browser.

declare namespace Spotify {
  interface Image {
    url: string;
    height?: number | null;
    width?: number | null;
  }

  interface Entity {
    uri: string;
    name: string;
  }

  interface Track {
    id: string | null;
    uri: string;
    type: string;
    name: string;
    duration_ms: number;
    album: { uri: string; name: string; images: Image[] };
    artists: Entity[];
    linked_from?: { id: string | null; uri: string | null };
  }

  interface PlaybackState {
    context: { uri: string | null };
    paused: boolean;
    position: number;
    duration: number;
    shuffle: boolean;
    /** 0 off, 1 context, 2 track */
    repeat_mode: 0 | 1 | 2;
    track_window: {
      current_track: Track | null;
      previous_tracks: Track[];
      next_tracks: Track[];
    };
  }

  interface Error {
    message: string;
  }

  interface PlayerInit {
    name: string;
    getOAuthToken: (cb: (token: string) => void) => void;
    volume?: number;
  }

  type ErrorEvent =
    | 'initialization_error'
    | 'authentication_error'
    | 'account_error'
    | 'playback_error'
    | 'autoplay_failed';

  class Player {
    constructor(options: PlayerInit);
    connect(): Promise<boolean>;
    disconnect(): void;
    addListener(event: 'ready' | 'not_ready', cb: (d: { device_id: string }) => void): boolean;
    addListener(event: 'player_state_changed', cb: (s: PlaybackState | null) => void): boolean;
    addListener(event: ErrorEvent, cb: (e?: Error) => void): boolean;
    getCurrentState(): Promise<PlaybackState | null>;
    setVolume(volume: number): Promise<void>;
    pause(): Promise<void>;
    togglePlay(): Promise<void>;
    seek(positionMs: number): Promise<void>;
    previousTrack(): Promise<void>;
    nextTrack(): Promise<void>;
    activateElement(): Promise<void>;
  }
}

interface Window {
  onSpotifyWebPlaybackSDKReady?: () => void;
  Spotify?: typeof Spotify;
}
