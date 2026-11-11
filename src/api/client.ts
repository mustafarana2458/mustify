import { forceRefresh, getAccessToken } from '../auth/authStore';
import { API_BASE } from '../auth/config';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const MAX_RATE_LIMIT_RETRIES = 2;

/**
 * Fetch wrapper for the official Web API (api.spotify.com/v1 only).
 * - attaches a fresh bearer token (refreshing proactively)
 * - on 401, refreshes once and retries
 * - on 429, waits Retry-After seconds and retries (bounded)
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  let token = await getAccessToken();
  let refreshed = false;
  let rateLimitRetries = 0;

  for (;;) {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

    const res = await fetch(url, { ...init, headers });

    if (res.status === 401 && !refreshed) {
      refreshed = true;
      token = await forceRefresh();
      continue;
    }
    if (res.status === 429 && rateLimitRetries < MAX_RATE_LIMIT_RETRIES) {
      rateLimitRetries++;
      const wait = Number(res.headers.get('Retry-After') ?? '1');
      await new Promise((r) => setTimeout(r, Math.min(wait, 30) * 1000));
      continue;
    }
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try {
        const j = (await res.json()) as { error?: { message?: string } };
        if (j.error?.message) msg = j.error.message;
      } catch {
        /* empty body */
      }
      throw new ApiError(msg, res.status);
    }
    // Several player endpoints return 204 No Content.
    if (res.status === 204 || res.headers.get('Content-Length') === '0') return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
}
