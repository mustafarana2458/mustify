// Mustify logo mark geometry: an "M" drawn as a single sound-wave stroke on a rounded tile.
// Original design. Shared by the React logo, the live favicon and the PNG icon generator
// (scripts/generate-icons.mts), so keep this file dependency-free.

export const MARK_VIEWBOX = 48;
/** The "M": up, down to a deep mid valley, up, down, like a waveform. */
export const MARK_PATH = 'M11.5 35 L17 18 L24 31.5 L31 18 L36.5 35';
export const MARK_STROKE = 4;
export const MARK_RADIUS = 13;
/** A small "beat" dot floating above the valley, between the peaks. */
export const MARK_DOT = { cx: 24, cy: 12.5, r: 2.4 };

export const DEFAULT_MARK_BG = '#1ED7A5';
export const DEFAULT_MARK_FG = '#000000';

export interface MarkSvgOptions {
  size?: number;
  bg?: string;
  fg?: string;
  /** rounded: tile with transparent corners. square: full bleed (maskable / iOS). */
  shape?: 'rounded' | 'square';
  /** Scales the M around the centre (e.g. to sit well inside a maskable safe zone). */
  contentScale?: number;
}

export function markSvg({
  size = MARK_VIEWBOX,
  bg = DEFAULT_MARK_BG,
  fg = DEFAULT_MARK_FG,
  shape = 'rounded',
  contentScale = 1,
}: MarkSvgOptions = {}): string {
  const s = MARK_VIEWBOX;
  const c = s / 2;
  const rx = shape === 'rounded' ? ` rx="${MARK_RADIUS}"` : '';
  const transform =
    contentScale === 1 ? '' : ` transform="translate(${c} ${c}) scale(${contentScale}) translate(${-c} ${-c})"`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${s} ${s}">` +
    `<rect width="${s}" height="${s}"${rx} fill="${bg}"/>` +
    `<g${transform}>` +
    `<path d="${MARK_PATH}" fill="none" stroke="${fg}" stroke-width="${MARK_STROKE}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="${MARK_DOT.cx}" cy="${MARK_DOT.cy}" r="${MARK_DOT.r}" fill="${fg}"/>` +
    `</g>` +
    `</svg>`
  );
}
