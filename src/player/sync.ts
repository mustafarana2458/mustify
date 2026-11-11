import { useEffect } from 'react';
import { pickImage } from '../lib/images';
import { toast } from '../store/toasts';
import {
  next,
  previous,
  refreshDevices,
  refreshPlayback,
  refreshQueue,
  seek,
  seekBy,
  togglePlay,
} from './controls';
import { startSdk } from './sdk';
import { currentPositionMs, itemFromSdk, selectIsLocal, usePlayer } from './store';

// Polling cadence (chosen). The Web API has no push channel, so remote state is polled.
// When this tab is the active device, SDK events are the main source and polling is slow.
const POLL_REMOTE_MS = 3000;
const POLL_LOCAL_MS = 10000;
const SEEK_STEP_MS = 10000; // Media Session seek forward/back step

const REPEAT_FROM_SDK = ['off', 'context', 'track'] as const;

function applySdkState(st: Spotify.PlaybackState) {
  const item = itemFromSdk(st.track_window.current_track);
  usePlayer.setState((s) => ({
    item,
    contextUri: st.context.uri,
    isPlaying: !st.paused,
    positionMs: st.position,
    updatedAt: Date.now(),
    shuffle: st.shuffle,
    repeat: REPEAT_FROM_SDK[st.repeat_mode] ?? 'off',
    queue: st.track_window.next_tracks.map(itemFromSdk).filter((x) => x !== null),
    // Our tab is the active device whenever the SDK reports a state.
    device:
      s.device?.id === s.sdkDeviceId
        ? s.device
        : { id: s.sdkDeviceId, name: 'This browser', type: 'Computer', is_active: true, volume_percent: null, supports_volume: true },
    seq: s.seq + 1,
  }));
}

/** Starts the SDK (desktop), polls /me/player, keeps the queue fresh, and drives Media Session. */
export function usePlayerSync() {
  // --- Web Playback SDK (desktop only) ---
  useEffect(() => {
    if (usePlayer.getState().mode !== 'sdk') return;
    usePlayer.setState({ sdkStatus: 'loading' });
    startSdk(
      {
        onReady: (id) => {
          usePlayer.setState({ sdkDeviceId: id, sdkStatus: 'ready', sdkError: null });
          void refreshDevices();
        },
        onNotReady: () => usePlayer.setState({ sdkStatus: 'loading' }),
        onState: (st) => (st ? applySdkState(st) : void refreshPlayback()),
        onError: (kind, message) => {
          console.warn(`[player] SDK ${kind}:`, message);
          if (kind === 'account_error') {
            usePlayer.setState({ sdkStatus: 'error', sdkError: 'Playing in the browser requires Spotify Premium.' });
            toast('Playing in the browser requires Spotify Premium.');
          } else if (kind === 'initialization_error') {
            // e.g. the browser lacks the required DRM support (EME).
            usePlayer.setState({ sdkStatus: 'error', sdkError: message });
            toast(`Web player unavailable: ${message}`);
          } else if (kind === 'autoplay_failed') {
            toast('The browser blocked autoplay. Press play to start.');
          } else if (kind === 'playback_error') {
            toast(`Playback error: ${message}`);
          }
        },
      },
      usePlayer.getState().volume,
    ).catch((e: Error) => {
      usePlayer.setState({ sdkStatus: 'error', sdkError: e.message });
      console.warn('[player] SDK failed to start:', e.message);
    });
    // The player is intentionally kept across re-mounts; it disconnects on logout (sdk.ts).
  }, []);

  // --- Polling ---
  useEffect(() => {
    let timer: number | undefined;
    let stopped = false;
    const tick = async () => {
      if (!document.hidden) await refreshPlayback();
      if (stopped) return;
      timer = window.setTimeout(tick, selectIsLocal(usePlayer.getState()) ? POLL_LOCAL_MS : POLL_REMOTE_MS);
    };
    void tick();
    void refreshDevices();
    const onVisible = () => {
      if (!document.hidden) void refreshPlayback();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);

  // --- Queue: refresh whenever the track changes (remote; the SDK supplies its own) ---
  useEffect(
    () =>
      usePlayer.subscribe((s, prev) => {
        if (s.item?.uri !== prev.item?.uri && s.item && !selectIsLocal(s)) void refreshQueue();
      }),
    [],
  );

  // --- Media Session (OS media keys / lock screen). Only meaningful when audio plays here. ---
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => !usePlayer.getState().isPlaying && void togglePlay()],
      ['pause', () => usePlayer.getState().isPlaying && void togglePlay()],
      ['previoustrack', () => void previous()],
      ['nexttrack', () => void next()],
      ['seekbackward', (d) => void seekBy(-(d.seekOffset ? d.seekOffset * 1000 : SEEK_STEP_MS))],
      ['seekforward', (d) => void seekBy(d.seekOffset ? d.seekOffset * 1000 : SEEK_STEP_MS)],
      ['seekto', (d) => d.seekTime != null && void seek(d.seekTime * 1000)],
    ];

    const sync = () => {
      const s = usePlayer.getState();
      const local = selectIsLocal(s);
      if (!local || !s.item) {
        ms.metadata = null;
        ms.playbackState = 'none';
        for (const [a] of handlers) trySet(a, null);
        return;
      }
      for (const [a, h] of handlers) trySet(a, h);
      const art = [96, 256, 512]
        .map((px) => pickImage(s.item!.album.images, px / (window.devicePixelRatio || 1)))
        .filter((u): u is string => !!u);
      ms.metadata = new MediaMetadata({
        title: s.item.name,
        artist: s.item.artists.map((a) => a.name).join(', '),
        album: s.item.album.name,
        artwork: [...new Set(art)].map((src) => ({ src })),
      });
      ms.playbackState = s.isPlaying ? 'playing' : 'paused';
      try {
        if (s.item.durationMs > 0) {
          ms.setPositionState({
            duration: s.item.durationMs / 1000,
            position: currentPositionMs(s) / 1000,
            playbackRate: 1,
          });
        }
      } catch {
        /* invalid position state (e.g. during a track change); next update fixes it */
      }
    };
    const trySet = (a: MediaSessionAction, h: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(a, h);
      } catch {
        /* action not supported by this browser */
      }
    };

    sync();
    return usePlayer.subscribe((s, prev) => {
      if (
        s.item !== prev.item ||
        s.isPlaying !== prev.isPlaying ||
        s.positionMs !== prev.positionMs ||
        s.device !== prev.device
      ) {
        sync();
      }
    });
  }, []);
}
