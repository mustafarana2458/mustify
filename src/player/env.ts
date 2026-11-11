/**
 * The Web Playback SDK does not support mobile browsers. On phones/tablets this app acts as a
 * Spotify Connect remote instead (controls whatever device is playing).
 * You can also force remote mode on desktop (Profile page) to test it.
 */
export const FORCE_REMOTE_KEY = 'player.forceRemote';

export function isMobileDevice(): boolean {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; distinguish by touch support.
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return iPadOS || /iPhone|iPad|iPod|Android|Mobile/i.test(ua);
}

export function shouldUseRemoteMode(): boolean {
  let forced = false;
  try {
    forced = localStorage.getItem(FORCE_REMOTE_KEY) === '1';
  } catch {
    /* storage unavailable */
  }
  return forced || isMobileDevice();
}
