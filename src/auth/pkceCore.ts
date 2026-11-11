// Pure PKCE helpers (no app imports), so they can be unit-tested in Node as well as used in
// the browser. RFC 7636.

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

/** Random string from the RFC 7636 "unreserved" alphabet (verifier: 43–128 chars). */
export function randomString(length: number): string {
  // Rejection sampling avoids modulo bias (256 isn't a multiple of 66).
  const limit = 256 - (256 % CHARSET.length);
  let out = '';
  while (out.length < length) {
    // getRandomValues allows at most 65,536 bytes per call.
    for (const b of crypto.getRandomValues(new Uint8Array(Math.min(length - out.length + 16, 4096)))) {
      if (b < limit && out.length < length) out += CHARSET[b % CHARSET.length];
    }
  }
  return out;
}

export function base64url(buffer: ArrayBuffer): string {
  let bin = '';
  for (const b of new Uint8Array(buffer)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** S256 code challenge: BASE64URL(SHA256(verifier)). */
export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(digest);
}

/** Redirect URI for wherever the app is served: dev, a preview deploy, or production. */
export function redirectUriFor(origin: string): string {
  return `${origin.replace(/\/+$/, '')}/callback`;
}

/** Login data is short-lived: an abandoned login can't be completed later. */
export const LOGIN_TTL_MS = 10 * 60 * 1000;

export interface PendingLogin {
  verifier: string;
  state: string;
  returnTo: string;
  createdAt: number;
}

/** Validates a callback against the stored pending login. Returns an error message or null. */
export function checkCallback(pending: PendingLogin | null, state: string | null, now: number): string | null {
  if (!pending) return 'missing';
  if (now - pending.createdAt > LOGIN_TTL_MS) return 'expired';
  if (!state || state !== pending.state) return 'state';
  return null;
}
