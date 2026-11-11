import { getAccessToken, useAuth } from '../auth/authStore';
import { APP_NAME } from '../brand/info';

const SDK_URL = 'https://sdk.scdn.co/spotify-player.js';
export const SDK_DEVICE_NAME = `${APP_NAME} (Web)`;

let player: Spotify.Player | null = null;
let starting: Promise<Spotify.Player> | null = null;

export const getSdkPlayer = () => player;

function loadScript(): Promise<void> {
  if (window.Spotify) return Promise.resolve();
  return new Promise((resolve, reject) => {
    // The SDK calls this global once it has finished loading.
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    if (document.querySelector(`script[src="${SDK_URL}"]`)) return;
    const s = document.createElement('script');
    s.src = SDK_URL;
    s.async = true;
    s.onerror = () => reject(new Error('Could not load the Spotify Web Playback SDK.'));
    document.head.appendChild(s);
  });
}

export interface SdkHandlers {
  onReady: (deviceId: string) => void;
  onNotReady: (deviceId: string) => void;
  onState: (state: Spotify.PlaybackState | null) => void;
  onError: (kind: Spotify.ErrorEvent, message: string) => void;
}

/** Loads the SDK and connects a player for this browser tab. Idempotent. */
export function startSdk(handlers: SdkHandlers, initialVolume: number): Promise<Spotify.Player> {
  if (starting) return starting;
  starting = (async () => {
    await loadScript();
    const p = new window.Spotify!.Player({
      name: SDK_DEVICE_NAME,
      // The SDK asks for a token whenever it needs one; we hand it a fresh (auto-refreshed) one.
      getOAuthToken: (cb) => {
        getAccessToken().then(cb, () => {});
      },
      volume: initialVolume,
    });
    player = p;
    p.addListener('ready', ({ device_id }) => handlers.onReady(device_id));
    p.addListener('not_ready', ({ device_id }) => handlers.onNotReady(device_id));
    p.addListener('player_state_changed', (s) => handlers.onState(s));
    for (const kind of [
      'initialization_error',
      'authentication_error',
      'account_error',
      'playback_error',
      'autoplay_failed',
    ] as const) {
      p.addListener(kind, (e) => handlers.onError(kind, e?.message ?? kind));
    }
    if (!(await p.connect())) throw new Error('The Web Playback SDK could not connect.');
    return p;
  })();
  starting.catch(() => {
    starting = null;
    player = null;
  });
  return starting;
}

export function stopSdk() {
  player?.disconnect();
  player = null;
  starting = null;
}

/** Browsers need playback to be "unlocked" by a user gesture; call at the start of a click. */
export function activateSdkElement() {
  void player?.activateElement().catch(() => {});
}

// Logging out disconnects this browser's player so it disappears from your device list.
useAuth.subscribe((s, prev) => {
  if (prev.refreshToken && !s.refreshToken) stopSdk();
});
