import { useEffect, useMemo, useState } from 'react';
import type { SpotifyImage } from '../api/types';
import { useAppearance } from '../store/appearance';
import { generatePalette } from '../theme/palette';
import { contrast, hexToHsl, hslToHex, toHex } from './color';
import { pickImage } from './images';

/*
 * Header colour from cover art, computed in the browser (UI-SPEC §4.2: the original app asks
 * a private backend for this; there is no official endpoint).
 * Method: draw a small copy of the cover on a canvas, bucket pixels by colour (4 bits per
 * channel), weight saturated pixels higher, and average the heaviest bucket.
 * Requires the image server to allow CORS (i.scdn.co does); otherwise we fall back.
 */

const SAMPLE = 24; // px, the canvas is SAMPLE×SAMPLE
const cache = new Map<string, Promise<string | null>>();

async function extract(url: string): Promise<string | null> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SAMPLE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
  const { data } = ctx.getImageData(0, 0, SAMPLE, SAMPLE); // throws if CORS-tainted

  const buckets = new Map<number, { r: number; g: number; b: number; n: number; w: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 128) continue;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    // Near-black and near-white pixels say little about the cover's colour.
    const weight = max < 24 || min > 232 ? 0.15 : 1 + sat * 3;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0, w: 0 };
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.n += 1;
    bucket.w += weight;
    buckets.set(key, bucket);
  }
  let best: { r: number; g: number; b: number; n: number; w: number } | undefined;
  for (const b of buckets.values()) if (!best || b.w > best.w) best = b;
  return best ? toHex([best.r / best.n, best.g / best.n, best.b / best.n]) : null;
}

export function extractColor(url: string): Promise<string | null> {
  let p = cache.get(url);
  if (!p) {
    p = extract(url).catch((e) => {
      console.info('[color] could not read cover colour (CORS or decode):', (e as Error).message);
      return null;
    });
    cache.set(url, p);
  }
  return p;
}

/**
 * Makes a raw cover colour usable as a header background for the current theme: limits
 * saturation, puts lightness in a theme-appropriate band, then darkens (dark themes) or
 * lightens (light themes) until the theme's text colour has ≥4.5:1 contrast on it.
 */
export function headerColorFor(raw: string, kind: 'dark' | 'light', fg: string): string {
  const [h, s, l] = hexToHsl(raw);
  const sat = Math.min(s, 70);
  let light = kind === 'dark' ? Math.min(42, Math.max(22, l)) : Math.min(90, Math.max(78, l));
  let c = hslToHex(h, sat, light);
  for (let i = 0; i < 40 && contrast(fg, c) < 4.5; i++) {
    light += kind === 'dark' ? -1.5 : 1.5;
    c = hslToHex(h, sat, light);
  }
  return c;
}

/** Header colour for a page, from its images; `fallback` (e.g. the accent) when unavailable. */
export function useHeaderColor(images: SpotifyImage[] | null | undefined, fallback: string): string {
  const appearance = useAppearance();
  const palette = useMemo(() => generatePalette(appearance), [appearance]);
  const url = pickImage(images, 64);
  const [raw, setRaw] = useState<string | null>(null);

  useEffect(() => {
    setRaw(null);
    if (!url) return;
    let cancelled = false;
    void extractColor(url).then((c) => !cancelled && setRaw(c));
    return () => {
      cancelled = true;
    };
  }, [url]);

  return headerColorFor(raw ?? fallback, palette.kind, palette.vars['--color-fg']);
}
