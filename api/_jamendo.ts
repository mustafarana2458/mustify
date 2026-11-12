// Shared rules for proxying Jamendo audio downloads (used by the Vercel Edge Function in
// api/jamendo-download.ts and by the dev-server middleware in vite.config.ts).
// Files starting with "_" are not deployed as routes by Vercel.
//
// Why a proxy: Jamendo's storage servers (prod-N.storage.jamendo.com) send no CORS headers, so
// the browser can't fetch() a download to save it offline. Playback streams don't need this
// (<audio> doesn't require CORS), and Jamendo's cover images already allow CORS.

/** Only Jamendo storage hosts may be proxied (never an open proxy). */
export const JAMENDO_STORAGE_HOST = /^prod-\d+\.storage\.jamendo\.com$/;

/** Hosts with a static rewrite (/jamendo-dl/prod-N/...) in vercel.json / netlify.toml / vite. */
export const REWRITTEN_HOST_NUMBERS = [1, 2, 3, 4];

export function isAllowedJamendoUrl(raw: string | null): URL | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
  return JAMENDO_STORAGE_HOST.test(u.hostname) ? u : null;
}

/**
 * Jamendo's download endpoint labels MP3 data as "text/html" (with a Content-Disposition
 * attachment). Saved files need a real audio type or iOS won't play them.
 */
export function audioContentType(upstreamType: string | null, url: URL): string {
  if (upstreamType && /^audio\//i.test(upstreamType)) return upstreamType;
  const hint = `${url.pathname} ${url.searchParams.get('format') ?? ''}`.toLowerCase();
  if (hint.includes('ogg')) return 'audio/ogg';
  if (hint.includes('flac')) return 'audio/flac';
  return 'audio/mpeg'; // mp31 / mp32
}

/** Response headers worth passing through (size, ranges, caching validators). */
export const PASS_THROUGH_HEADERS = ['content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified'];
