import { DEFAULT_MARK_BG, MARK_DOT, MARK_PATH, MARK_RADIUS, MARK_STROKE, MARK_VIEWBOX, markSvg } from './mark';

/*
 * App icons in the chosen accent colour, generated in the browser.
 *
 * When the accent changes, the logo mark is drawn on a canvas at 180 / 192 / 512 px plus a
 * maskable 512, and the page's icon links are pointed at the results:
 *   - <link rel="apple-touch-icon">  → used by iOS "Add to Home Screen"
 *   - <link rel="icon">              → browser tab (SVG, crisp at any size)
 *   - <link rel="manifest">          → a copy of the built manifest whose icons are the new
 *                                       images, served from a blob: URL (Android/desktop install)
 * With the default accent the original static files in public/icons are restored.
 *
 * Already-installed icons don't change: the OS copies the icon at install time.
 */

type Shape = 'rounded' | 'square';

const REGEN_DELAY_MS = 300; // wait for the colour picker to settle (chosen)

/** Draws the mark directly on a canvas (Path2D accepts SVG path data); returns a PNG data URL. */
function drawIcon(size: number, shape: Shape, bg: string, fg: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const k = size / MARK_VIEWBOX;
  ctx.scale(k, k);

  ctx.fillStyle = bg;
  ctx.beginPath();
  if (shape === 'rounded') roundedRect(ctx, 0, 0, MARK_VIEWBOX, MARK_VIEWBOX, MARK_RADIUS);
  else ctx.rect(0, 0, MARK_VIEWBOX, MARK_VIEWBOX);
  ctx.fill();

  ctx.strokeStyle = fg;
  ctx.lineWidth = MARK_STROKE;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(new Path2D(MARK_PATH));

  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.arc(MARK_DOT.cx, MARK_DOT.cy, MARK_DOT.r, 0, Math.PI * 2);
  ctx.fill();

  return canvas.toDataURL('image/png');
}

/** Rounded rectangle path (ctx.roundRect isn't in older Safari). */
function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Original (static teal) hrefs, captured once, so the default accent can restore them.
let defaults: { manifest: string | null; apple: string | null; favicon: string | null } | null = null;
let baseManifest: Promise<Record<string, unknown> | null> | null = null;
let manifestBlobUrl: string | null = null;
let timer: number | undefined;
let lastKey = '';

const link = (rel: string) => document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);

function captureDefaults() {
  if (defaults) return;
  defaults = {
    manifest: link('manifest')?.getAttribute('href') ?? null,
    apple: link('apple-touch-icon')?.getAttribute('href') ?? null,
    favicon: link('icon')?.getAttribute('href') ?? null,
  };
}

/** The built manifest (only present in production builds; dev has no PWA). */
function loadBaseManifest(): Promise<Record<string, unknown> | null> {
  if (!baseManifest) {
    const href = defaults?.manifest;
    baseManifest = href
      ? fetch(href)
          .then((r) => (r.ok ? (r.json() as Promise<Record<string, unknown>>) : null))
          .catch(() => null)
      : Promise.resolve(null);
  }
  return baseManifest;
}

function restoreDefaults() {
  if (!defaults) return;
  if (defaults.apple) link('apple-touch-icon')?.setAttribute('href', defaults.apple);
  if (defaults.favicon) link('icon')?.setAttribute('href', defaults.favicon);
  if (defaults.manifest) link('manifest')?.setAttribute('href', defaults.manifest);
  if (manifestBlobUrl) URL.revokeObjectURL(manifestBlobUrl);
  manifestBlobUrl = null;
}

async function generate(accent: string, onAccent: string) {
  // Browser tab icon: SVG (sharp at every size).
  link('icon')?.setAttribute('href', `data:image/svg+xml,${encodeURIComponent(markSvg({ bg: accent, fg: onAccent }))}`);

  const apple = drawIcon(180, 'square', accent, onAccent); // iOS rounds it itself
  if (apple) link('apple-touch-icon')?.setAttribute('href', apple);

  const manifestLink = link('manifest');
  const base = await loadBaseManifest();
  if (!manifestLink || !base) return;
  const origin = window.location.origin;
  const manifest = {
    ...base,
    // A blob: manifest resolves relative URLs against "blob:", so make them absolute.
    id: `${origin}/`,
    start_url: `${origin}/`,
    scope: `${origin}/`,
    theme_color: accent,
    icons: [
      { src: drawIcon(192, 'rounded', accent, onAccent), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: drawIcon(512, 'rounded', accent, onAccent), sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: drawIcon(512, 'square', accent, onAccent), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' }));
  manifestLink.setAttribute('href', url);
  if (manifestBlobUrl) URL.revokeObjectURL(manifestBlobUrl);
  manifestBlobUrl = url;
}

/** Point the page's icons at the given accent (debounced). Default accent → static files. */
export function updateAppIcons(accent: string, onAccent: string) {
  captureDefaults();
  const key = `${accent}|${onAccent}`.toUpperCase();
  if (key === lastKey) return;
  lastKey = key;
  window.clearTimeout(timer);
  if (accent.toUpperCase() === DEFAULT_MARK_BG.toUpperCase()) {
    restoreDefaults();
    return;
  }
  timer = window.setTimeout(() => {
    generate(accent, onAccent).catch((e) => console.warn('[icons] could not generate accent icons', e));
  }, REGEN_DELAY_MS);
}
