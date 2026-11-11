import { useEffect, useState } from 'react';
import { useAuth } from '../auth/authStore';
import { api } from './client';

export interface Query<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
}

/**
 * Tiny GET cache: identical paths requested within CACHE_TTL_MS share one request
 * (e.g. /me is used by the top bar, Home and Profile at the same time).
 */
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; promise: Promise<unknown> }>();

export function cachedGet<T>(path: string): Promise<T> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.promise as Promise<T>;
  const promise = api<T>(path);
  cache.set(path, { at: Date.now(), promise });
  promise.catch(() => cache.delete(path)); // don't cache failures
  return promise;
}

/** Drops cached GETs whose path starts with `prefix` (after a write changes them). */
export function invalidateCache(prefix: string) {
  for (const key of cache.keys()) if (key.startsWith(prefix)) cache.delete(key);
}

// Never let one account's cached data leak into the next login.
useAuth.subscribe((s, prev) => {
  if (prev.refreshToken && !s.refreshToken) cache.clear();
});

export function useApi<T>(path: string | null): Query<T> {
  return useAsync<T>(path === null ? null : () => cachedGet<T>(path), [path]);
}

/**
 * Runs an async loader when `key` changes (pass loader=null to skip).
 * Used for composite queries that combine several endpoints.
 */
export function useAsync<T>(loader: (() => Promise<T>) | null, deps: unknown[]): Query<T> {
  const [state, setState] = useState<Query<T>>({
    data: undefined,
    error: undefined,
    loading: loader !== null,
  });

  useEffect(() => {
    if (loader === null) return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    loader()
      .then((data) => !cancelled && setState({ data, error: undefined, loading: false }))
      .catch((error: Error) => !cancelled && setState({ data: undefined, error, loading: false }));
    return () => {
      cancelled = true;
    };
    // deps are supplied by the caller (like useMemo); the loader closure is recreated each render.
  }, deps);

  return state;
}
