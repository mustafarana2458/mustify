import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../auth/authStore';
import { completeLogin } from '../auth/pkce';

export function CallbackPage() {
  const navigate = useNavigate();
  const setTokens = useAuth((s) => s.setTokens);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const denied = params.get('error');
    const code = params.get('code');
    if (denied) {
      setError(denied === 'access_denied' ? 'You declined the login.' : denied);
      return;
    }
    if (!code) {
      setError('Missing authorization code.');
      return;
    }
    completeLogin(code, params.get('state'))
      .then(({ tokens, returnTo }) => {
        setTokens(tokens);
        navigate(returnTo, { replace: true });
      })
      .catch((e: Error) => setError(e.message));
  }, [navigate, setTokens]);

  return (
    <main className="flex min-h-full items-center justify-center p-4">
      {error ? (
        <div className="max-w-sm rounded-lg bg-surface p-8 text-center">
          <p className="mb-4 text-danger">Login failed: {error}</p>
          <Link to="/" replace className="font-bold underline">
            Back to start
          </Link>
        </div>
      ) : (
        <p className="text-fg-muted">Signing you in…</p>
      )}
    </main>
  );
}
