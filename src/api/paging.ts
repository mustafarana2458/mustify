import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './client';
import type { Paging } from './types';

/** Follows `next` links until done or `max` items (sidebar library loading). */
export async function fetchAll<T>(first: string, max = 500): Promise<T[]> {
  const out: T[] = [];
  let next: string | null = first;
  while (next && out.length < max) {
    const page: Paging<T> = await api<Paging<T>>(next);
    out.push(...page.items);
    next = page.next;
  }
  return out;
}

export interface PagedList<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  loadingMore: boolean;
  error: Error | undefined;
  loadMore: () => void;
}

/**
 * Continues a paged list from an already-fetched first page (e.g. the tracks embedded in
 * GET /playlists/{id}), fetching further pages on demand via the `next` URL.
 * `pick` extracts the paging object when follow-up responses wrap it (search: {tracks: …}).
 */
export function usePagingContinuation<T>(
  initial: Paging<T> | undefined,
  pick?: (response: unknown) => Paging<T> | undefined,
): PagedList<T> {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const next = useRef<string | null>(null);
  const generation = useRef(0);
  const busy = useRef(false);
  const pickRef = useRef(pick);
  pickRef.current = pick;

  useEffect(() => {
    generation.current++;
    busy.current = false;
    setItems(initial?.items ?? []);
    setTotal(initial?.total ?? 0);
    setError(undefined);
    setLoadingMore(false);
    next.current = initial?.next ?? null;
  }, [initial]);

  const loadMore = useCallback(() => {
    if (busy.current || !next.current) return;
    busy.current = true;
    const gen = generation.current;
    setLoadingMore(true);
    api<unknown>(next.current)
      .then((res) => {
        if (gen !== generation.current) return;
        const page = (pickRef.current ? pickRef.current(res) : res) as Paging<T> | undefined;
        next.current = page?.next ?? null;
        setItems((prev) => [...prev, ...(page?.items ?? [])]);
        if (page) setTotal(page.total);
      })
      .catch((e: Error) => gen === generation.current && setError(e))
      .finally(() => {
        if (gen !== generation.current) return;
        busy.current = false;
        setLoadingMore(false);
      });
  }, []);

  return { items, total, hasMore: next.current !== null, loadingMore, error, loadMore };
}
