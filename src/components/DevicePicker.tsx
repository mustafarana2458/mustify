import {
  Car,
  Gamepad2,
  Laptop,
  MonitorSpeaker,
  Smartphone,
  Speaker,
  Tablet,
  Tv,
  type LucideIcon,
} from 'lucide-react';
import { NO_DEVICE_MESSAGE, refreshDevices, transferTo } from '../player/controls';
import { SDK_DEVICE_NAME } from '../player/sdk';
import { usePlayer, type Device } from '../player/store';
import { thisDeviceId } from '../player/target';
import { IconButton } from './IconButton';
import { Menu, type MenuItem } from './Menu';

/** Shown on phones (remote mode) when nothing is available to play on. */
export const NO_DEVICE_HINT = NO_DEVICE_MESSAGE;

const ICONS: Record<string, LucideIcon> = {
  computer: Laptop,
  smartphone: Smartphone,
  tablet: Tablet,
  speaker: Speaker,
  tv: Tv,
  castvideo: Tv,
  castaudio: Speaker,
  avr: Speaker,
  stb: Tv,
  audiodongle: Speaker,
  gameconsole: Gamepad2,
  automobile: Car,
};

/**
 * Spotify Connect device picker (GET /me/player/devices, PUT /me/player to transfer).
 * Opens upward from the player bar. Refreshes the list each time it opens.
 */
export function DevicePicker({ size = 'sm', align = 'end' }: { size?: 'sm' | 'md' | 'touch'; align?: 'start' | 'end' }) {
  const devices = usePlayer((s) => s.devices);
  const activeId = usePlayer((s) => s.device?.id ?? null);
  const sdkDeviceId = usePlayer((s) => s.sdkDeviceId);
  const remoteActive = usePlayer((s) => !!s.device && s.device.id !== s.sdkDeviceId);
  const mine = usePlayer((s) => thisDeviceId(s));

  // This browser may not be in Spotify's list yet right after the SDK connects.
  const list: Device[] =
    sdkDeviceId && !devices.some((d) => d.id === sdkDeviceId)
      ? [{ id: sdkDeviceId, name: SDK_DEVICE_NAME, type: 'Computer', is_active: false, volume_percent: null, supports_volume: true }, ...devices]
      : devices;

  const items: MenuItem[] = list
    .filter((d): d is Device & { id: string } => !!d.id)
    .map((d) => ({
      id: d.id,
      label: d.id === sdkDeviceId ? 'This browser' : d.name,
      description: [d.id === mine && d.id !== sdkDeviceId ? 'This phone' : null, d.id === activeId ? 'Listening on' : d.type]
        .filter(Boolean)
        .join(' · '),
      icon: ICONS[d.type.toLowerCase()] ?? Speaker,
      checked: d.id === activeId,
      onSelect: () => d.id !== activeId && void transferTo(d.id),
    }));

  return (
    <Menu
      side="top"
      align={align}
      onOpenChange={(open) => open && void refreshDevices()}
      header={
        <p className="text-sm font-bold">
          Connect to a device
          {items.length === 0 && (
            <span className="mt-1 block max-w-64 text-xs font-normal text-fg-muted">{NO_DEVICE_HINT}</span>
          )}
        </p>
      }
      items={items}
      trigger={(props) => (
        <IconButton label="Connect to a device" size={size} active={remoteActive || undefined} {...props}>
          <MonitorSpeaker className={size === 'sm' ? 'size-4' : 'size-5'} aria-hidden />
        </IconButton>
      )}
    />
  );
}
