import { getLastDevice } from './lastDevice';
import { usePlayer, type PlayerState } from './store';

/*
 * Which device should "play" use?
 *   1. A device you explicitly picked in the device menu during THIS session, if it's still
 *      available. Kept in sessionStorage, so it resets to "this device" on the next launch.
 *   2. Otherwise THIS device:
 *        desktop (SDK mode): this browser's Web Playback SDK device ("Mustify (Web)")
 *        phone (remote mode): the phone's own Spotify app, matched by device type
 *        "Smartphone", never a computer. Among several smartphones, the one previously
 *        remembered as this phone wins, then an active one, then the first.
 * Never "whatever was last active", which is what sent audio to the laptop before.
 */

const SESSION_KEY = 'player.sessionDevice';

export function getSessionChoice(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function setSessionChoice(deviceId: string | null) {
  try {
    if (deviceId) sessionStorage.setItem(SESSION_KEY, deviceId);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable: choice just isn't remembered */
  }
}

export const isSmartphone = (type: string | undefined) => (type ?? '').toLowerCase() === 'smartphone';

/** This device's Spotify Connect id, or null if it isn't available (phone app not open). */
export function thisDeviceId(s: PlayerState = usePlayer.getState()): string | null {
  if (s.mode === 'sdk') return s.sdkDeviceId;
  const phones = s.devices.filter((d) => d.id && isSmartphone(d.type) && !d.is_restricted);
  const last = getLastDevice();
  return (
    (last && phones.find((d) => d.id === last.id)?.id) ??
    phones.find((d) => d.is_active)?.id ??
    phones[0]?.id ??
    null
  );
}

/** Device that "play" should use: this session's manual choice, else this device. */
export function targetDeviceId(s: PlayerState = usePlayer.getState()): string | null {
  const chosen = getSessionChoice();
  if (chosen && s.devices.some((d) => d.id === chosen)) return chosen;
  return thisDeviceId(s);
}

/** Name of the device playing when it isn't this device (for the "Playing on …" bar). */
export function selectOtherDeviceName(s: PlayerState): string | null {
  if (s.engine !== 'spotify' || !s.device?.is_active || !s.device.id) return null;
  return s.device.id === thisDeviceId(s) ? null : s.device.name;
}
