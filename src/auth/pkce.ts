// Authorization Code with PKCE (RFC 7636). No client secret is involved.

import { APP_NAME } from '../brand/info';
import { AUTHORIZE_URL, CLIENT_ID, REDIRECT_URI, SCOPES, TOKEN_URL } from './config';
import { challengeFor, checkCallback, randomString, type PendingLogin } from './pkceCore';

/*
 * The pending login (verifier + state) is kept in localStorage, not sessionStorage.
 * Why: on iOS, a home-screen app that navigates to accounts.spotify.com and is redirected
 * back is not guaranteed to resume the same "session" (iOS may reload the web app), and
 * sessionStorage would then be empty. localStorage belongs to the web app's own storage, so
 * it survives. It is deleted as soon as the login completes and expires after 10 minutes.
 */
const PENDING_KEY = 'pkce.pending';

function readPending(): PendingLogin | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingLogin) : null;
  } catch {
    return null;
  }
}

function clearPending() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** True when running as an installed app (home screen / desktop install). */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
}

/**
 * Sends the browser to Spotify's consent page in the SAME window (location.assign).
 * Important on iOS: a home-screen app keeps a same-window navigation inside the app (shown
 * with a small browser bar) and returns to the app on redirect. A new window/tab would open
 * Safari, which has separate storage and could never finish the login.
 */
export async function beginLogin(returnTo = '/'): Promise<void> {
  const pending: PendingLogin = { verifier: randomString(64), state: randomString(16), returnTo, createdAt: Date.now() };
  localStorage.setItem(PENDING_KEY, JSON.stringify(pending));

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: await challengeFor(pending.verifier),
    scope: SCOPES.join(' '),
    state: pending.state,
  });
  window.location.assign(`${AUTHORIZE_URL}?${params}`);
}

async function postToken(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const j = (await res.json()) as { error?: string; error_description?: string };
      detail = j.error_description || j.error || detail;
    } catch {
      /* non-JSON error body */
    }
    throw new TokenError(detail, res.status);
  }
  return (await res.json()) as TokenResponse;
}

export class TokenError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'TokenError';
  }
}

const MESSAGES: Record<string, () => string> = {
  missing: () =>
    isStandalone()
      ? 'Login data not found. Please try logging in again.'
      : `Login data not found in this browser. If you started logging in from the ${APP_NAME} app on your home screen, iOS may have finished it in Safari instead: close this page, open ${APP_NAME} from the home screen and log in there again.`,
  expired: () => 'The login took too long and expired. Please try again.',
  state: () => 'Security check failed (state mismatch). Please try logging in again.',
};

// React StrictMode runs effects twice in dev. An auth code is single-use, so the
// exchange is memoised per code to avoid a second (failing) request.
const exchanges = new Map<string, Promise<{ tokens: TokenResponse; returnTo: string }>>();

/** Validates state and exchanges the ?code= for tokens. */
export function completeLogin(code: string, state: string | null) {
  const existing = exchanges.get(code);
  if (existing) return existing;

  const p = (async () => {
    const pending = readPending();
    const problem = checkCallback(pending, state, Date.now());
    if (problem) {
      if (problem !== 'missing') clearPending();
      throw new Error(MESSAGES[problem]());
    }
    const tokens = await postToken(
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: pending!.verifier,
      }),
    );
    clearPending();
    return { tokens, returnTo: pending!.returnTo || '/' };
  })();
  exchanges.set(code, p);
  return p;
}

export function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  return postToken(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    }),
  );
}
