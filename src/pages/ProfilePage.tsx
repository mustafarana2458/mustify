import { LogOut, RefreshCw, User } from 'lucide-react';
import { useState } from 'react';
import { useApi } from '../api/hooks';
import type { UserProfile } from '../api/types';
import { forceRefresh, useAuth } from '../auth/authStore';
import { REDIRECT_URI } from '../auth/config';
import { Button } from '../components/Button';
import { LayoutDiagnostics } from '../components/LayoutDiagnostics';
import { FORCE_REMOTE_KEY, isMobileDevice } from '../player/env';
import { usePlayer } from '../player/store';

/** Phase 1 test page: proves login, API access, refresh and logout all work. */
export function ProfilePage() {
  const { data: me, error, loading } = useApi<UserProfile>('/me');
  const logout = useAuth((s) => s.logout);
  const expiresAt = useAuth((s) => s.expiresAt);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);
  const mode = usePlayer((s) => s.mode);
  const sdkStatus = usePlayer((s) => s.sdkStatus);
  const sdkError = usePlayer((s) => s.sdkError);
  const forcedRemote = mode === 'remote' && !isMobileDevice();

  const avatar = me?.images?.[0]?.url;

  return (
    <div className="p-6">
      <div className="w-full max-w-md rounded-lg bg-elevated p-8">
        {loading && <p className="text-fg-muted">Loading your profile…</p>}
        {error && <p className="text-danger">Could not load profile: {error.message}</p>}

        {me && (
          <div className="mb-8 flex items-center gap-4">
            {avatar ? (
              <img src={avatar} alt="" className="size-20 rounded-full object-cover shadow-card" />
            ) : (
              <div className="flex size-20 items-center justify-center rounded-full bg-elevated shadow-card">
                <User className="size-10 text-fg-muted" aria-hidden />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase text-fg-muted">Signed in as</p>
              <h1 className="truncate text-3xl font-extrabold tracking-tight">
                {me.display_name ?? me.id}
              </h1>
              <p className="text-sm text-fg-muted">
                {me.product === 'premium' ? 'Premium' : (me.product ?? 'Unknown plan')}
                {me.country ? ` · ${me.country}` : ''}
              </p>
            </div>
          </div>
        )}

        <p className="mb-4 text-xs text-fg-muted">
          Access token expires {new Date(expiresAt).toLocaleTimeString()}
        </p>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setRefreshMsg('Refreshing…');
              forceRefresh()
                .then(() => setRefreshMsg('Token refreshed.'))
                .catch((e: Error) => setRefreshMsg(`Refresh failed: ${e.message}`));
            }}
          >
            <RefreshCw className="size-4" aria-hidden /> Refresh token now
          </Button>
          <Button variant="secondary" size="sm" onClick={logout}>
            <LogOut className="size-4" aria-hidden /> Log out
          </Button>
        </div>
        {refreshMsg && <p className="mt-3 text-sm text-fg-muted">{refreshMsg}</p>}

        <hr className="my-6 border-divider" />
        <h2 className="mb-1 font-bold">Spotify app settings</h2>
        <p className="text-sm text-fg-muted">This address must be listed under Redirect URIs in your Spotify dashboard:</p>
        <code className="mt-1 block rounded-xs bg-tint px-2 py-1 text-sm break-all">{REDIRECT_URI}</code>

        <hr className="my-6 border-divider" />
        <LayoutDiagnostics />

        <hr className="my-6 border-divider" />
        <h2 className="mb-1 font-bold">Playback mode</h2>
        <p className="mb-3 text-sm text-fg-muted">
          {mode === 'sdk'
            ? `This browser can play audio (Web Playback SDK${sdkStatus === 'error' ? `, unavailable: ${sdkError}` : `: ${sdkStatus}`}).`
            : 'Remote only: this browser controls other Spotify devices (Spotify Connect).'}
        </p>
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-[var(--color-accent)]"
            checked={forcedRemote}
            disabled={isMobileDevice()}
            onChange={(e) => {
              try {
                if (e.target.checked) localStorage.setItem(FORCE_REMOTE_KEY, '1');
                else localStorage.removeItem(FORCE_REMOTE_KEY);
              } catch {
                /* storage unavailable */
              }
              window.location.reload();
            }}
          />
          Use this browser as a remote only (reloads the page)
        </label>
      </div>
    </div>
  );
}
