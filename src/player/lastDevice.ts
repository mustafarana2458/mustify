/**
 * The last Spotify Connect device you played on (id + name), kept in localStorage.
 * iOS suspends the Spotify app in the background and it then drops out of the device list;
 * remembering it lets us look for it again and transfer back to it automatically.
 */
const KEY = 'player.lastDevice';

export interface RememberedDevice {
  id: string;
  name: string;
}

export function getLastDevice(): RememberedDevice | null {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as RememberedDevice) : null;
    return v && typeof v.id === 'string' && typeof v.name === 'string' ? v : null;
  } catch {
    return null;
  }
}

export function setLastDevice(d: RememberedDevice) {
  try {
    if (getLastDevice()?.id !== d.id) localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* storage unavailable */
  }
}
