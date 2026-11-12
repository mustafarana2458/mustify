import { api } from '../api/client';
import { getSdkPlayer } from '../player/sdk';
import { selectIsLocal, usePlayer, type PlaybackItem, type RepeatMode } from '../player/store';
import { toast } from '../store/toasts';
import { offlineUri, type Playable } from './types';

/*
 * In-app audio engine for the Offline section (Jamendo / Audius / your files). It plays with
 * a single HTML5 <audio> element and writes into the same player store as Spotify, so the
 * player bar, mini player, full-screen player, shortcuts and lock-screen controls all work
 * unchanged (player/controls.ts routes commands here while engine === 'local').
 *
 * iOS: audio may only start from a user gesture. playQueue() is called from a tap and first
 * "unlocks" the element synchronously with a silent clip; later src changes (next track,
 * also from the lock screen) are then allowed on the same element. Audio keeps playing when
 * the screen locks because it plays inside the page.
 */

// Smallest valid WAV (no samples): used to unlock the element inside the tap.
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
const MAX_SKIPS_ON_ERROR = 3;

let audio: HTMLAudioElement | null = null;
let unlocked = false;
let queue: Playable[] = [];
let order: number[] = [];
let pos = 0;
let currentUrl: string | null = null;
let loadSeq = 0;
let errorSkips = 0;
let shuffle = false;
let repeat: RepeatMode = 'off';

const isActive = () => usePlayer.getState().engine === 'local';

function el(): HTMLAudioElement {
  if (audio) return audio;
  const a = new Audio();
  a.preload = 'auto';
  a.setAttribute('playsinline', '');
  a.setAttribute('webkit-playsinline', '');
  a.addEventListener('timeupdate', () => {
    if (isActive() && a.src !== SILENT_WAV) usePlayer.setState({ positionMs: a.currentTime * 1000, updatedAt: Date.now() });
  });
  a.addEventListener('play', () => {
    if (isActive() && a.src !== SILENT_WAV) {
      usePlayer.setState((s) => ({ isPlaying: true, positionMs: a.currentTime * 1000, updatedAt: Date.now(), seq: s.seq + 1 }));
    }
  });
  a.addEventListener('pause', () => {
    if (isActive()) usePlayer.setState((s) => ({ isPlaying: false, positionMs: a.currentTime * 1000, updatedAt: Date.now(), seq: s.seq + 1 }));
  });
  a.addEventListener('playing', () => (errorSkips = 0));
  a.addEventListener('durationchange', () => {
    const s = usePlayer.getState();
    if (isActive() && s.item && Number.isFinite(a.duration) && a.duration > 0) {
      usePlayer.setState({ item: { ...s.item, durationMs: Math.round(a.duration * 1000) } });
    }
  });
  a.addEventListener('ended', () => void onEnded());
  a.addEventListener('error', () => {
    if (!isActive() || !a.src || a.src === SILENT_WAV) return;
    toast("Couldn't play this track.");
    if (++errorSkips <= MAX_SKIPS_ON_ERROR) void next();
  });
  audio = a;
  return a;
}

/** Must run synchronously inside a tap/click. */
function unlock() {
  const a = el();
  if (unlocked) return;
  unlocked = true;
  a.src = SILENT_WAV;
  a.play().then(
    // Only pause the silent clip; by now the real track may already have replaced it.
    () => a.src === SILENT_WAV && a.pause(),
    () => (unlocked = false),
  );
}

function buildOrder(start: number) {
  const idx = queue.map((_, i) => i);
  if (shuffle) {
    const rest = idx.filter((i) => i !== start);
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    order = [start, ...rest];
    pos = 0;
  } else {
    order = idx;
    pos = start;
  }
}

function toItem(t: Playable, cover?: string): PlaybackItem {
  return {
    id: null,
    uri: offlineUri(t.id),
    name: t.title,
    durationMs: t.durationMs,
    kind: 'local',
    album: { id: null, uri: '', name: t.album ?? '', images: cover ? [{ url: cover, width: null, height: null }] : [] },
    artists: [{ id: null, uri: '', name: t.artist }],
    attribution: t.attribution,
  };
}

function upcoming() {
  return order.slice(pos + 1, pos + 11).map((i) => toItem(queue[i], queue[i].coverUrl));
}

async function loadCurrent(autoplay: boolean) {
  const my = ++loadSeq;
  const t = queue[order[pos]];
  if (!t) return;
  usePlayer.setState((s) => ({
    item: toItem(t, t.coverUrl),
    positionMs: 0,
    updatedAt: Date.now(),
    queue: upcoming(),
    contextUri: null,
    seq: s.seq + 1,
  }));
  if (!t.coverUrl && t.getCover) {
    void t.getCover().then((c) => {
      const s = usePlayer.getState();
      if (c && my === loadSeq && s.item?.uri === offlineUri(t.id)) usePlayer.setState({ item: toItem(t, c) });
    });
  }

  let url: string;
  try {
    url = await t.getAudioUrl();
  } catch (e) {
    toast((e as Error).message || "Couldn't open this track.");
    return;
  }
  if (my !== loadSeq) {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    return;
  }
  const a = el();
  if (currentUrl?.startsWith('blob:')) URL.revokeObjectURL(currentUrl);
  currentUrl = url;
  a.src = url;
  if (!autoplay) return;
  try {
    await a.play();
  } catch (e) {
    usePlayer.setState({ isPlaying: false });
    if ((e as DOMException).name === 'NotAllowedError') toast('Tap play to start.');
  }
}

/** Pauses Spotify so the two engines never play at the same time. */
function pauseSpotify() {
  const s = usePlayer.getState();
  if (s.engine !== 'spotify' || !s.isPlaying || !s.item) return;
  if (selectIsLocal(s)) void getSdkPlayer()?.pause().catch(() => {});
  else void api('/me/player/pause', { method: 'PUT' }).catch(() => {});
}

/** Play a list (from a tap), starting at `index`. */
export function playQueue(list: Playable[], index: number) {
  unlock(); // synchronous, inside the gesture
  pauseSpotify();
  queue = list;
  buildOrder(Math.max(0, Math.min(index, list.length - 1)));
  usePlayer.setState((s) => ({ engine: 'local', shuffle, repeat, isPlaying: false, seq: s.seq + 1 }));
  void loadCurrent(true);
}

/** Hand the player back to Spotify (called when Spotify playback is started). */
export function stopLocal() {
  if (!isActive()) return;
  loadSeq++;
  const a = el();
  a.pause();
  a.removeAttribute('src');
  a.load();
  if (currentUrl?.startsWith('blob:')) URL.revokeObjectURL(currentUrl);
  currentUrl = null;
  queue = [];
  usePlayer.setState((s) => ({ engine: 'spotify', item: null, isPlaying: false, queue: [], seq: s.seq + 1 }));
}

// ---------- controls (player/controls.ts delegates here while the engine is active) ----------

export const isLocalEngine = isActive;

export function localToggle() {
  const a = el();
  if (a.paused) void a.play().catch(() => toast('Tap play to start.'));
  else a.pause();
}

export function next() {
  if (pos < order.length - 1) pos++;
  else if (repeat === 'context') {
    if (shuffle) buildOrder(order[0]);
    pos = 0;
  } else return;
  void loadCurrent(true);
}

export function previous() {
  if (pos > 0) pos--;
  else if (repeat === 'context') pos = order.length - 1;
  else {
    localSeek(0);
    return;
  }
  void loadCurrent(true);
}

async function onEnded() {
  if (!isActive()) return;
  if (repeat === 'track') {
    localSeek(0);
    void el().play();
    return;
  }
  if (pos < order.length - 1 || repeat === 'context') next();
  else usePlayer.setState({ isPlaying: false, positionMs: usePlayer.getState().item?.durationMs ?? 0, updatedAt: Date.now() });
}

export function localSeek(ms: number) {
  const a = el();
  a.currentTime = Math.max(0, ms / 1000);
  usePlayer.setState({ positionMs: Math.max(0, ms), updatedAt: Date.now() });
}

export function localSetShuffle(on: boolean) {
  shuffle = on;
  const current = order[pos];
  if (current !== undefined) buildOrder(current);
  usePlayer.setState({ shuffle: on, queue: upcoming() });
}

export function localCycleRepeat() {
  repeat = repeat === 'off' ? 'context' : repeat === 'context' ? 'track' : 'off';
  usePlayer.setState({ repeat });
}

/** Note: iOS ignores programmatic volume (hardware buttons only); other platforms apply it. */
export function localSetVolume(v: number) {
  el().volume = Math.max(0, Math.min(1, v));
  usePlayer.setState({ volume: v });
}
