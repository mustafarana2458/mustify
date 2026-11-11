/** 3:05 */
export function formatTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** "1 hr 12 min" / "42 min 7 sec" (header totals). */
export function formatTotal(ms: number): string {
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} hr ${m} min`;
  return `${m} min ${s % 60} sec`;
}

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

/** "3 days ago" for the last month, otherwise "Mar 3, 2024". */
export function formatAdded(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 2000) return ''; // very old placeholder dates
  const diffSec = (d.getTime() - Date.now()) / 1000;
  const abs = Math.abs(diffSec);
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), 'day');
  return dateFmt.format(d);
}

/** Long release date, tolerating "2020" / "2020-05" precision. */
export function formatReleaseDate(date: string | undefined): string {
  if (!date) return '';
  if (/^\d{4}$/.test(date)) return date;
  const d = new Date(date.length === 7 ? `${date}-01` : date);
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'long',
    ...(date.length > 7 ? { day: 'numeric' } : {}),
  }).format(d);
}

/**
 * Playlist descriptions arrive as HTML (links, entities). Render as plain text.
 * DOMParser builds an inert document: no scripts run and nothing is inserted into the page.
 */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return '';
  return new DOMParser().parseFromString(html, 'text/html').body.textContent?.trim() ?? '';
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
