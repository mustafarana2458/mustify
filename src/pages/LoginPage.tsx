import { useState } from 'react';
import { APP_TAGLINE, AUTHOR } from '../brand/info';
import { beginLogin } from '../auth/pkce';
import { isConfigured } from '../auth/config';
import { Button } from '../components/Button';
import { Wordmark } from '../components/Logo';

export function LoginPage() {
  const [busy, setBusy] = useState(false);
  const configured = isConfigured();

  return (
    <div className="flex min-h-full flex-col items-center bg-app p-4">
      <main className="flex w-full flex-1 items-center justify-center">
        <div className="w-full max-w-sm rounded-lg bg-surface px-8 py-10 text-center">
          <Wordmark size={44} className="mb-3" />
          <p className="mb-10 text-sm text-fg-muted">{APP_TAGLINE}</p>

          {configured ? (
            <Button
              size="lg"
              className="w-full"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void beginLogin();
              }}
            >
              {busy ? 'Redirecting…' : 'Log in with Spotify'}
            </Button>
          ) : (
            <p className="rounded-sm bg-tint p-4 text-left text-sm text-warning">
              No Client ID configured. Copy <code>.env.example</code> to <code>.env</code>, set{' '}
              <code>VITE_SPOTIFY_CLIENT_ID</code>, then restart <code>npm run dev</code>.
            </p>
          )}
          <p className="mt-4 text-xs text-fg-muted">Uses your Spotify account. Playback needs Premium.</p>
        </div>
      </main>
      <footer className="pt-6 pb-2 text-xs text-fg-muted">Crafted by {AUTHOR.name}</footer>
    </div>
  );
}
