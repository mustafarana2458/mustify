import { WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { useOffline } from '../offline/store';

/** Pages that work without internet. Everything else needs Spotify, which is online-only. */
const OFFLINE_OK = ['/offline', '/about', '/settings/appearance', '/profile'];

/** Without internet, Spotify pages are replaced by a pointer to your offline music. */
export function OfflineGate({ children }: { children: ReactNode }) {
  const online = useOffline((s) => s.online);
  const { pathname } = useLocation();
  if (online || OFFLINE_OK.some((p) => pathname.startsWith(p))) return <>{children}</>;
  return (
    <div className="flex flex-col items-center px-6 pt-[calc(4rem+env(safe-area-inset-top))] pb-10 text-center">
      <WifiOff className="mb-4 size-10 text-fg-muted" aria-hidden />
      <h1 className="mb-2 text-2xl font-bold">You're offline</h1>
      <p className="mb-6 max-w-sm text-sm text-fg-muted">
        Spotify needs an internet connection. Your downloaded and imported music still plays.
      </p>
      <Link
        to="/offline"
        className="inline-flex min-h-12 items-center rounded-full bg-accent px-6 font-bold text-on-accent transition-transform duration-150 hover:scale-[1.04] hover:bg-accent-hover active:bg-accent-press"
      >
        Go to Offline
      </Link>
    </div>
  );
}

/** Small "Offline" pill for the top bar / mobile header. */
export function OfflineBadge({ className = '' }: { className?: string }) {
  const online = useOffline((s) => s.online);
  if (online) return null;
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1.5 rounded-full bg-warning px-2.5 py-1 text-xs font-bold text-black ${className}`}
    >
      <WifiOff className="size-3.5" aria-hidden />
      Offline
    </span>
  );
}
