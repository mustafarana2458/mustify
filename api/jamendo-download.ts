// Vercel Edge Function: GET /api/jamendo-download?url=<Jamendo storage URL>
// Fallback for Jamendo storage hosts without a static rewrite in vercel.json. Streams the file
// through (no buffering, so no body-size limit), forwards Range requests, and sets a proper
// audio Content-Type. Only https://prod-N.storage.jamendo.com URLs are accepted.
import { audioContentType, isAllowedJamendoUrl, JAMENDO_STORAGE_HOST, PASS_THROUGH_HEADERS } from './_jamendo';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  const target = isAllowedJamendoUrl(new URL(req.url).searchParams.get('url'));
  if (!target) return new Response('Only Jamendo storage URLs can be fetched here.', { status: 403 });

  const range = req.headers.get('range');
  let upstream: Response;
  try {
    upstream = await fetch(target, { method: req.method, headers: range ? { range } : {}, redirect: 'follow' });
  } catch {
    return new Response('Jamendo storage could not be reached.', { status: 502 });
  }
  // A redirect must not lead outside Jamendo storage either.
  if (!JAMENDO_STORAGE_HOST.test(new URL(upstream.url).hostname)) {
    return new Response('Unexpected redirect.', { status: 502 });
  }

  const headers = new Headers();
  for (const h of PASS_THROUGH_HEADERS) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set('content-type', audioContentType(upstream.headers.get('content-type'), target));
  headers.set('cache-control', 'public, max-age=86400');
  return new Response(req.method === 'HEAD' ? null : upstream.body, { status: upstream.status, headers });
}
