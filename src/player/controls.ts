import { api, ApiError } from '../api/client';
import { toast } from '../store/toasts';
import {
  isLocalEngine,
  localCycleRepeat,
  localSeek,
  localSetShuffle,
  localSetVolume,
  localToggle,
  next as localNext,
  previous as localPrevious,
  stopLocal,
} from '../offline/engine';
import { getLastDevice, setLastDevice } from './lastDevice';
import { activateSdkElement, getSdkPlayer } from './sdk';
import {
  currentPositionMs,
  itemFromApi,
  selectIsLocal,
  usePlayer,
  type Device,
  type PlayerState,
  type RepeatMode,
} from './store';

/*
 * Playback commands. All go through the official Web API (/me/player/*) except that when this
 * tab is the active device, transport/seek/volume use the SDK directly (instant, no round-trip).
 * Shuffle/repeat always use the Web API (the SDK has no methods for them).
 * Each command updates the UI optimistically, reverts on failure, then re-syncs.
 * While the Offline section's in-app engine is active (engine === 'local'), transport,
 * seek, shuffle, repeat and volume are routed to it instead (offline/engine.ts).
 */

const RESYNC_AFTER_MS = 500; // chosen: give Spotify a moment to apply the change
const RESTART_THRESHOLD_MS = 3000; // "previous" restarts the track if past 3s (common player behaviour)

function describe(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 404) return 'No active device. Pick one with the Connect button.';
    if (e.status === 403) return e.message || 'Spotify refused this action (Premium is required for playback control).';
    if (e.status === 429) return 'Too many requests. Try again in a moment.';
    return e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong.';
}

/**
 * Builds the query string, adding ?device_id= when a device must be targeted explicitly:
 * the given one, or this browser (desktop) when nothing is active yet.
 */
function deviceQuery(extra: Record<string, string | number | boolean> = {}, deviceId?: string): string {
  const s = usePlayer.getState();
  const params = new URLSearchParams(Object.entries(extra).map(([k, v]) => [k, String(v)]));
  const target = deviceId ?? (!s.device && s.sdkDeviceId ? s.sdkDeviceId : undefined);
  if (target) params.set('device_id', target);
  const q = params.toString();
  return q ? `?${q}` : '';
}

/** Shows the "open Spotify on this phone" message, unless the banner already says it. */
function showNoDeviceHint() {
  if (!usePlayer.getState().deviceHintVisible) toast(NO_DEVICE_MESSAGE);
}

export const NO_DEVICE_MESSAGE = 'Open the Spotify app on this phone once, then pick it from the device list.';

/**
 * Runs a command with an optimistic UI update. Only a non-2xx response counts as failure
 * (the API client never throws for 2xx). On failure the optimistic change is reverted.
 * Either way the real state is re-read from /me/player afterwards, so the UI can't drift.
 */
async function command(optimistic: Partial<PlayerState>, run: () => Promise<unknown>, resync = true) {
  const before = usePlayer.getState();
  const revert = Object.fromEntries(
    Object.keys(optimistic).map((k) => [k, before[k as keyof PlayerState]]),
  ) as Partial<PlayerState>;
  usePlayer.setState((s) => ({ ...optimistic, seq: s.seq + 1 }));
  try {
    await run();
  } catch (e) {
    usePlayer.setState((s) => ({ ...revert, seq: s.seq + 1 }));
    if (e instanceof ApiError && e.status === 404 && usePlayer.getState().mode === 'remote') {
      // The device went away (typically the Spotify app was suspended by iOS).
      void findDevices();
      showNoDeviceHint();
    } else {
      toast(describe(e));
    }
  }
  if (resync) setTimeout(() => void refreshPlayback(), RESYNC_AFTER_MS);
}

// ---------- reads ----------

interface PlayerResponse {
  device: Device;
  shuffle_state: boolean;
  repeat_state: RepeatMode;
  progress_ms: number | null;
  is_playing: boolean;
  item: Parameters<typeof itemFromApi>[0];
  context: { uri: string } | null;
}

/** GET /me/player. Discards the result if a command/SDK event happened meanwhile. */
export async function refreshPlayback(): Promise<void> {
  // While the Offline engine plays, Spotify's state must not overwrite the player.
  if (isLocalEngine()) return;
  const seq = usePlayer.getState().seq;
  let res: PlayerResponse | undefined;
  try {
    res = await api<PlayerResponse | undefined>('/me/player?additional_types=episode');
  } catch (e) {
    console.warn('[player] refresh failed', e);
    return;
  }
  if (usePlayer.getState().seq !== seq || isLocalEngine()) return;
  if (res?.device?.id && res.device.id !== usePlayer.getState().sdkDeviceId) {
    setLastDevice({ id: res.device.id, name: res.device.name });
  }
  if (!res) {
    // 204: nothing is active anywhere.
    usePlayer.setState({ device: null, item: null, isPlaying: false, positionMs: 0, updatedAt: Date.now(), contextUri: null });
    return;
  }
  usePlayer.setState({
    device: res.device,
    item: itemFromApi(res.item),
    contextUri: res.context?.uri ?? null,
    isPlaying: res.is_playing,
    positionMs: res.progress_ms ?? 0,
    updatedAt: Date.now(),
    shuffle: res.shuffle_state,
    repeat: res.repeat_state,
    // Local volume comes from the SDK; remote volume from the device.
    ...(selectIsLocal({ ...usePlayer.getState(), device: res.device }) || res.device.volume_percent == null
      ? {}
      : { volume: res.device.volume_percent / 100 }),
  });
}

export async function refreshDevices(): Promise<Device[]> {
  try {
    const res = await api<{ devices: Device[] } | null>('/me/player/devices');
    const devices = res?.devices ?? [];
    usePlayer.setState({ devices });
    return devices;
  } catch (e) {
    console.warn('[player] devices failed', e);
    return usePlayer.getState().devices;
  }
}

const DEVICE_RETRY_EVERY_MS = 2000;
const DEVICE_RETRY_ATTEMPTS = 5; // ≈10s in total
let searching: Promise<void> | null = null;

/**
 * Remote mode: looks for a device to control, retrying every 2s for ~10s (the Spotify app on
 * iOS takes a moment to come back online after being woken). If the device you last used
 * reappears while nothing is active, playback is quietly transferred back to it (paused), so
 * the next ▶ just works. Single-flight: concurrent callers share one search.
 */
export function findDevices(): Promise<void> {
  if (usePlayer.getState().mode !== 'remote') return refreshDevices().then(() => undefined);
  if (searching) return searching;
  usePlayer.setState({ searchingDevices: true });
  searching = (async () => {
    for (let attempt = 0; attempt < DEVICE_RETRY_ATTEMPTS; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, DEVICE_RETRY_EVERY_MS));
      const devices = await refreshDevices();
      if (usePlayer.getState().device) return; // something is already active
      const active = devices.find((d) => d.is_active && d.id);
      if (active) {
        await refreshPlayback();
        return;
      }
      const last = getLastDevice();
      const remembered = last && devices.find((d) => d.id === last.id);
      if (remembered?.id) {
        try {
          await api('/me/player', { method: 'PUT', body: JSON.stringify({ device_ids: [remembered.id], play: false }) });
          await refreshPlayback();
          return;
        } catch (e) {
          console.warn('[player] transfer to remembered device failed', e);
        }
      }
    }
  })().finally(() => {
    searching = null;
    usePlayer.setState({ searchingDevices: false });
  });
  return searching;
}

export async function refreshQueue(): Promise<void> {
  try {
    const res = await api<{ queue: Parameters<typeof itemFromApi>[0][] } | undefined>('/me/player/queue');
    usePlayer.setState({ queue: (res?.queue ?? []).map(itemFromApi).filter((x) => x !== null).slice(0, 10) });
  } catch (e) {
    console.warn('[player] queue failed', e);
  }
}

// ---------- commands ----------

export function togglePlay() {
  if (isLocalEngine()) return localToggle();
  const s = usePlayer.getState();
  if (!s.item) return;
  activateSdkElement();
  const local = selectIsLocal(s);
  const sdk = getSdkPlayer();
  return command(
    { isPlaying: !s.isPlaying, positionMs: currentPositionMs(s), updatedAt: Date.now() },
    () =>
      local && sdk
        ? sdk.togglePlay()
        : api(`/me/player/${s.isPlaying ? 'pause' : 'play'}${deviceQuery()}`, { method: 'PUT' }),
    !local,
  );
}

export function next() {
  if (isLocalEngine()) return localNext();
  const s = usePlayer.getState();
  const local = selectIsLocal(s);
  const sdk = getSdkPlayer();
  return command({}, () => (local && sdk ? sdk.nextTrack() : api(`/me/player/next${deviceQuery()}`, { method: 'POST' })), !local);
}

export function previous() {
  if (isLocalEngine()) return currentPositionMs() > RESTART_THRESHOLD_MS ? localSeek(0) : localPrevious();
  const s = usePlayer.getState();
  if (currentPositionMs(s) > RESTART_THRESHOLD_MS) return seek(0);
  const local = selectIsLocal(s);
  const sdk = getSdkPlayer();
  return command(
    {},
    () => (local && sdk ? sdk.previousTrack() : api(`/me/player/previous${deviceQuery()}`, { method: 'POST' })),
    !local,
  );
}

export function seek(positionMs: number) {
  if (isLocalEngine()) return localSeek(Math.max(0, positionMs));
  const s = usePlayer.getState();
  const ms = Math.round(Math.max(0, Math.min(s.item?.durationMs ?? 0, positionMs)));
  const local = selectIsLocal(s);
  const sdk = getSdkPlayer();
  return command(
    { positionMs: ms, updatedAt: Date.now() },
    () => (local && sdk ? sdk.seek(ms) : api(`/me/player/seek${deviceQuery({ position_ms: ms })}`, { method: 'PUT' })),
    !local,
  );
}

export function seekBy(deltaMs: number) {
  return seek(currentPositionMs() + deltaMs);
}

export function setShuffle(state: boolean) {
  if (isLocalEngine()) return localSetShuffle(state);
  return command({ shuffle: state }, () => api(`/me/player/shuffle${deviceQuery({ state })}`, { method: 'PUT' }));
}

export function cycleRepeat() {
  if (isLocalEngine()) return localCycleRepeat();
  const r = usePlayer.getState().repeat;
  const nextMode: RepeatMode = r === 'off' ? 'context' : r === 'context' ? 'track' : 'off';
  return command({ repeat: nextMode }, () => api(`/me/player/repeat${deviceQuery({ state: nextMode })}`, { method: 'PUT' }));
}

/**
 * Volume 0..1. Locally the SDK applies it instantly on every change; for a remote device only
 * `commit` sends a request (on slider release) to stay well inside rate limits.
 */
export function setVolume(volume: number, commit: boolean) {
  if (isLocalEngine()) return localSetVolume(Math.max(0, Math.min(1, volume)));
  const v = Math.max(0, Math.min(1, volume));
  const s = usePlayer.getState();
  if (selectIsLocal(s)) {
    usePlayer.setState({ volume: v });
    void getSdkPlayer()?.setVolume(v);
    return;
  }
  if (!commit) {
    usePlayer.setState({ volume: v });
    return;
  }
  if (s.device && !s.device.supports_volume) {
    toast(`${s.device.name} doesn't allow volume control.`);
    return;
  }
  return command({ volume: v }, () =>
    api(`/me/player/volume${deviceQuery({ volume_percent: Math.round(v * 100) })}`, { method: 'PUT' }),
  );
}

export function changeVolumeBy(delta: number) {
  return setVolume(usePlayer.getState().volume + delta, true);
}

export function toggleMute() {
  const s = usePlayer.getState();
  if (s.volume > 0) {
    usePlayer.setState({ volumeBeforeMute: s.volume });
    return setVolume(0, true);
  }
  const restore = s.volumeBeforeMute ?? 0.5;
  usePlayer.setState({ volumeBeforeMute: null });
  return setVolume(restore, true);
}

export interface PlayRequest {
  contextUri?: string;
  /** Start at this track (by URI)… */
  offsetUri?: string;
  /** …or at this 0-based position (needed when a playlist contains the same track twice). */
  offsetPosition?: number;
  uris?: string[];
}

/** POST /me/player/queue for each URI, in order. Needs an active device. */
export async function addToQueue(uris: string[]) {
  if (uris.length === 0) return;
  try {
    for (const uri of uris) {
      await api(`/me/player/queue${deviceQuery({ uri })}`, { method: 'POST' });
    }
    toast(uris.length === 1 ? 'Added to queue.' : `Added ${uris.length} songs to queue.`);
    setTimeout(() => void refreshQueue(), RESYNC_AFTER_MS);
  } catch (e) {
    toast(describe(e));
  }
}

/**
 * Start playing a context (playlist/album/artist/show/Liked Songs) or track list.
 * Target: the active device if there is one; otherwise this browser (desktop SDK).
 * In remote mode with nothing active, asks you to choose a device.
 */
export async function play(req: PlayRequest) {
  // Starting Spotify playback hands the player back from the Offline engine.
  stopLocal();
  activateSdkElement();
  const s = usePlayer.getState();
  // Remote mode with nothing active: try the remembered device (or the only one available)
  // before asking you to open Spotify.
  let targetDevice: string | undefined;
  if (!s.device && !s.sdkDeviceId) {
    if (s.mode !== 'remote') {
      toast('The web player is still starting. Try again in a moment.');
      return;
    }
    const devices = await refreshDevices();
    const last = getLastDevice();
    const usable = devices.filter((d) => d.id);
    targetDevice = (last && usable.find((d) => d.id === last.id)?.id) ?? (usable.length === 1 ? usable[0].id! : last?.id);
    if (!targetDevice) {
      void findDevices();
      showNoDeviceHint();
      return;
    }
    try {
      await api('/me/player', { method: 'PUT', body: JSON.stringify({ device_ids: [targetDevice], play: false }) });
    } catch {
      // Remembered device is offline (e.g. iOS suspended the Spotify app).
      void findDevices();
      showNoDeviceHint();
      return;
    }
  }
  const body: Record<string, unknown> = {};
  if (req.contextUri) body.context_uri = req.contextUri;
  if (req.uris) body.uris = req.uris;
  if (req.offsetUri) body.offset = { uri: req.offsetUri };
  else if (req.offsetPosition != null) body.offset = { position: req.offsetPosition };

  const send = () => api(`/me/player/play${deviceQuery({}, targetDevice)}`, { method: 'PUT', body: JSON.stringify(body) });
  await command({ isPlaying: true, contextUri: req.contextUri ?? null, positionMs: 0, updatedAt: Date.now() }, async () => {
    try {
      await send();
    } catch (e) {
      // A just-registered SDK device can 404 until it has been "activated" once: transfer, retry.
      if (e instanceof ApiError && e.status === 404 && s.sdkDeviceId && !s.device) {
        await api('/me/player', { method: 'PUT', body: JSON.stringify({ device_ids: [s.sdkDeviceId], play: false }) });
        await send();
      } else throw e;
    }
  });
}

/** Move playback to another device (Spotify Connect), keeping play/pause state. */
export async function transferTo(deviceId: string) {
  stopLocal();
  const s = usePlayer.getState();
  activateSdkElement();
  const target = s.devices.find((d) => d.id === deviceId) ?? null;
  if (target && deviceId !== s.sdkDeviceId) setLastDevice({ id: deviceId, name: target.name });
  await command({ device: target ? { ...target, is_active: true } : s.device }, () =>
    api('/me/player', { method: 'PUT', body: JSON.stringify({ device_ids: [deviceId], play: s.isPlaying }) }),
  );
  setTimeout(() => void refreshDevices(), 800);
}
