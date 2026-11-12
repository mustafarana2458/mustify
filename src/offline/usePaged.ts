import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Offset-paged fetching for the Jamendo/Audius browsers: resets when `key` changes, appends on
 * loadMore(). A page shorter than `pageSize` means there's nothing more.
 */
export function usePaged<T>(key: string | null, fetchPage: (offset: number) => Promise<T[]>, pageSize: number) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const gen = useRef(0);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const load = useCallback(
    (offset: number, myGen: number) => {
      setLoading(true);
      setError(null);
      fetchRef
        .current(offset)
        .then((page) => {
          if (myGen !== gen.current) return;
          setItems((prev) => (offset === 0 ? page : [...prev, ...page]));
          setHasMore(page.length >= pageSize);
        })
        .catch((e: Error) => myGen === gen.current && setError(e))
        .finally(() => myGen === gen.current && setLoading(false));
    },
    [pageSize],
  );

  useEffect(() => {
    const my = ++gen.current;
    setItems([]);
    setHasMore(false);
    if (key === null) return;
    load(0, my);
  }, [key, load]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) load(items.length, gen.current);
  }, [loading, hasMore, items.length, load]);

  return { items, loading, error, hasMore, loadMore };
}

/** Debounced copy of a value (search boxes). */
export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}
