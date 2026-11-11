// Small colour helpers (sRGB hex). Used to derive accent variants and readable text colours.

export type RGB = [number, number, number];

/** Accepts #RGB or #RRGGBB (with or without #). Returns null if invalid. */
export function parseHex(input: string): RGB | null {
  const m = input.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(m)) return [0, 1, 2].map((i) => parseInt(m[i] + m[i], 16)) as RGB;
  if (/^[0-9a-f]{6}$/i.test(m)) return [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16)) as RGB;
  return null;
}

export function toHex([r, g, b]: RGB): string {
  return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** Normalised #RRGGBB, or null if invalid. */
export function normalizeHex(input: string): string | null {
  const rgb = parseHex(input);
  return rgb ? toHex(rgb) : null;
}

/** Hex → [hue 0–360, saturation 0–100, lightness 0–100]. */
export function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = parseHex(hex)!.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
}

/** HSL (h 0–360, s/l 0–100) → hex. */
export function hslToHex(h: number, s: number, l: number): string {
  const S = Math.max(0, Math.min(100, s)) / 100;
  const L = Math.max(0, Math.min(100, l)) / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return toHex([f(0) * 255, f(8) * 255, f(4) * 255]);
}

/** Opaque result of drawing `top` at `alpha` over `bottom` (for contrast checks of overlays). */
export function composite(bottom: string, top: string, alpha: number): string {
  return mix(bottom, top, alpha);
}

/** CSS rgb() with alpha from a hex colour. */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex)!;
  return `rgb(${r} ${g} ${b} / ${Math.round(alpha * 1000) / 1000})`;
}

/** Linear blend: t=0 → a, t=1 → b. */
export function mix(a: string, b: string, t: number): string {
  const x = parseHex(a)!;
  const y = parseHex(b)!;
  return toHex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t) as RGB);
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex)!.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio (1–21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Black or white, whichever reads better on `bg`. */
export function readableOn(bg: string): '#000000' | '#FFFFFF' {
  return contrast(bg, '#000000') >= contrast(bg, '#FFFFFF') ? '#000000' : '#FFFFFF';
}

/**
 * Nudges `fg` toward black or white (away from `bg`) until it reaches `min` contrast.
 * Used so accent-coloured text/icons stay visible, e.g. a pale pink accent on a white page.
 */
export function ensureContrast(fg: string, bg: string, min: number): string {
  if (contrast(fg, bg) >= min) return normalizeHex(fg)!;
  const target = luminance(bg) > 0.5 ? '#000000' : '#FFFFFF';
  for (let t = 0.05; t <= 1; t += 0.05) {
    const c = mix(fg, target, t);
    if (contrast(c, bg) >= min) return c;
  }
  return target;
}
