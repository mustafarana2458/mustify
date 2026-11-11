import { useEffect } from 'react';
import { create } from 'zustand';
import { useAuth } from '../auth/authStore';
import { useLibrary } from '../store/library';
import { toast } from '../store/toasts';
import { api } from './client';
import { invalidateCache } from './hooks';

/**
 * Liked Songs membership, shared by track rows, the player bar and the Now Playing panel.
 *   check:  GET    /me/tracks/contains?ids=  (batched: up to 50 ids per request)
 *   like:   PUT    /me/tracks?ids=
 *   unlike: DELETE /me/tracks?ids=
 * Checks from many rows are collected for a moment and sent together, so a 100-track
 * playlist costs 2 requests, not 100. If the endpoints fail, buttons show as unavailable.
 */
type Saved = boolean | 'error';

/**
 * `version` bumps after every successful like/unlike so lists built from /me/tracks
 * (the Liked Songs page) know to refetch.
 */
const useSaved = create<{ saved: Record<string, Saved>; version: number }>()(() => ({ saved: {}, version: 0 }));

export const useLikesVersion = () => useSaved((s) => s.version);
const pending = new Set<string>();
const inFlight = new Set<string>();
let flushTimer: number | undefined;
const BATCH = 50;
const BATCH_DELAY_MS = 30; // chosen

useAuth.subscribe((s, prev) => {
  if (prev.refreshToken && !s.refreshToken) useSaved.setState({ saved: {}, version: 0 });
});

async function flush() {
  flushTimer = undefined;
  const ids = [...pending];
  pending.clear();
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    chunk.forEach((id) => inFlight.add(id));
    try {
      const res = await api<boolean[]>(`/me/tracks/contains?ids=${chunk.join(',')}`);
      useSaved.setState((s) => {
        const saved = { ...s.saved };
        chunk.forEach((id, j) => (saved[id] = !!res[j]));
        return { saved };
      });
    } catch (e) {
      console.warn('[library] contains failed', e);
      useSaved.setState((s) => {
        const saved = { ...s.saved };
        chunk.forEach((id) => (saved[id] = 'error'));
        return { saved };
      });
    } finally {
      chunk.forEach((id) => inFlight.delete(id));
    }
  }
}

function requestCheck(id: string) {
  if (id in useSaved.getState().saved || pending.has(id) || inFlight.has(id)) return;
  pending.add(id);
  if (flushTimer === undefined) flushTimer = window.setTimeout(() => void flush(), BATCH_DELAY_MS);
}

export function getSavedTrack(id: string): Saved | undefined {
  return useSaved.getState().saved[id];
}

export async function setTrackSaved(id: string, value: boolean) {
  const before = useSaved.getState().saved[id];
  useSaved.setState((s) => ({ saved: { ...s.saved, [id]: value } }));
  try {
    await api(`/me/tracks?ids=${encodeURIComponent(id)}`, { method: value ? 'PUT' : 'DELETE' });
    invalidateCache('/me/tracks');
    useSaved.setState((s) => ({ version: s.version + 1 }));
    // Keep the sidebar's "Liked Songs · N songs" count in step.
    if (before !== value) {
      useLibrary.setState((s) => (s.likedTotal == null ? {} : { likedTotal: Math.max(0, s.likedTotal + (value ? 1 : -1)) }));
    }
    toast(value ? 'Added to Liked Songs.' : 'Removed from Liked Songs.');
  } catch (e) {
    useSaved.setState((s) => ({ saved: { ...s.saved, [id]: before ?? 'error' } }));
    toast(`Couldn't update Liked Songs: ${(e as Error).message}`);
  }
}

/** Returns [saved (undefined while loading, 'error' if unavailable), toggle]. */
export function useSavedTrack(id: string | null | undefined): [Saved | undefined, () => void] {
  const value = useSaved((s) => (id ? s.saved[id] : undefined));
  useEffect(() => {
    if (id) requestCheck(id);
  }, [id]);
  const toggle = () => {
    if (id && typeof value === 'boolean') void setTrackSaved(id, !value);
  };
  return [value, toggle];
}
