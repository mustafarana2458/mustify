import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { refreshTokens, TokenError, type TokenResponse } from './pkce';

/**
 * Tokens are persisted in localStorage so a reload keeps you signed in.
 * Trade-off for a personal app: anything that can run script on this origin could read them.
 * There is no third-party script on this origin; keep it that way.
 */
interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  /** epoch ms when the access token expires */
  expiresAt: number;
  scope: string;
  setTokens: (t: TokenResponse) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      expiresAt: 0,
      scope: '',
      setTokens: (t) =>
        set({
          accessToken: t.access_token,
          // Spotify may or may not rotate the refresh token; keep the old one if none is returned.
          refreshToken: t.refresh_token ?? get().refreshToken,
          expiresAt: Date.now() + t.expires_in * 1000,
          scope: t.scope,
        }),
      // Spotify has no token-revocation endpoint for PKCE clients, so logout = forget tokens.
      // To fully revoke access, remove the app at https://www.spotify.com/account/apps/
      logout: () => set({ accessToken: null, refreshToken: null, expiresAt: 0, scope: '' }),
    }),
    { name: 'auth' },
  ),
);

export const selectIsLoggedIn = (s: AuthState) => s.refreshToken !== null || s.accessToken !== null;

/** Refresh this long before actual expiry so in-flight requests don't race the deadline. */
const EXPIRY_MARGIN_MS = 60_000;

let inFlight: Promise<string> | null = null;

/** Forces a refresh. Concurrent callers share one network request (single-flight). */
export function forceRefresh(): Promise<string> {
  if (inFlight) return inFlight;
  const { refreshToken, setTokens, logout } = useAuth.getState();
  if (!refreshToken) return Promise.reject(new Error('Not logged in'));

  inFlight = refreshTokens(refreshToken)
    .then((t) => {
      setTokens(t);
      return t.access_token;
    })
    .catch((err: unknown) => {
      // 400 invalid_grant = refresh token revoked/expired → must log in again.
      // Network errors keep the session so a later retry can succeed.
      if (err instanceof TokenError && err.status === 400) logout();
      throw err;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Returns a valid access token, refreshing first if it is (nearly) expired. */
export async function getAccessToken(): Promise<string> {
  const { accessToken, expiresAt } = useAuth.getState();
  if (accessToken && Date.now() < expiresAt - EXPIRY_MARGIN_MS) return accessToken;
  return forceRefresh();
}
