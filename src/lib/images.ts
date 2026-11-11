import type { SpotifyImage } from '../api/types';

/**
 * Picks the smallest image at least `minPx` wide (×devicePixelRatio), else the largest.
 * Spotify lists images largest-first, but sizes can be null, so sort defensively.
 */
export function pickImage(images: SpotifyImage[] | null | undefined, minPx: number): string | undefined {
  if (!images || images.length === 0) return undefined;
  const need = minPx * (window.devicePixelRatio || 1);
  const sized = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  return (sized.find((i) => (i.width ?? 0) >= need) ?? sized[sized.length - 1]).url;
}
