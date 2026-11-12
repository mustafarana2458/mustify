import { HardDrive, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Chip } from '../components/Chip';
import { HScroller } from '../components/HScroller';
import { requestPersistence } from '../offline/db';
import { loadOffline, refreshStorage, useOffline } from '../offline/store';
import { AudiusSection } from './offline/AudiusSection';
import { DiscoverSection } from './offline/DiscoverSection';
import { DownloadedSection } from './offline/DownloadedSection';
import { ImportSection } from './offline/ImportSection';

type Tab = 'downloaded' | 'discover' | 'audius' | 'import';

const TABS: { key: Tab; label: string; needsInternet: boolean }[] = [
  { key: 'downloaded', label: 'Downloaded', needsInternet: false },
  { key: 'discover', label: 'Discover', needsInternet: true },
  { key: 'audius', label: 'Audius', needsInternet: true },
  { key: 'import', label: 'Import', needsInternet: false },
];

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(0, Math.round(n / 1024))} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
}

function StorageLine() {
  const storage = useOffline((s) => s.storage);
  const count = useOffline((s) => s.tracks.length);
  if (!storage) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted">
      <HardDrive className="size-4" aria-hidden />
      <span>
        {count} {count === 1 ? 'track' : 'tracks'} · using {formatBytes(storage.usage)}
        {storage.quota ? ` of ${formatBytes(storage.quota)} available` : ''}
      </span>
      {storage.persisted ? (
        <span>· Kept on this device</span>
      ) : (
        <button
          type="button"
          className="min-h-11 font-bold text-fg hover:underline"
          onClick={async () => {
            await requestPersistence();
            await refreshStorage();
          }}
        >
          · Keep downloads safe
        </button>
      )}
    </p>
  );
}

/**
 * Offline (hybrid): Spotify stays online-only; this section plays legally downloadable music
 * inside the app: Jamendo (Creative Commons), Audius (artist-enabled downloads) and your own
 * files. Without internet only Downloaded and Import are shown.
 */
export function OfflinePage() {
  const online = useOffline((s) => s.online);
  const [tab, setTab] = useState<Tab>('downloaded');

  useEffect(() => {
    void loadOffline();
    void refreshStorage();
  }, []);

  const tabs = TABS.filter((t) => online || !t.needsInternet);
  const current = tabs.some((t) => t.key === tab) ? tab : 'downloaded';

  return (
    <div className="px-6 pt-[calc(1rem+env(safe-area-inset-top))] pb-10 max-md:px-4 max-md:pt-[calc(0.5rem+env(safe-area-inset-top))]">
      <h1 className="text-3xl font-bold tracking-tight">Offline</h1>
      <div className="mt-1 mb-4">
        <StorageLine />
      </div>

      {!online && (
        <p role="status" className="mb-4 flex items-center gap-2 rounded-md bg-elevated p-3 text-sm">
          <WifiOff className="size-4 shrink-0 text-warning" aria-hidden />
          You're offline. Your downloads and imported music still play.
        </p>
      )}

      <HScroller label="Offline sections" className="mb-5" trackClassName="flex gap-2">
        {tabs.map((t) => (
          <Chip key={t.key} selected={current === t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </Chip>
        ))}
      </HScroller>

      {current === 'downloaded' && <DownloadedSection />}
      {current === 'discover' && <DiscoverSection />}
      {current === 'audius' && <AudiusSection />}
      {current === 'import' && <ImportSection />}
    </div>
  );
}
