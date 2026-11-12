import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { screenHeight } from '../lib/safeArea';

interface Metrics {
  mode: string;
  standalone: boolean;
  /** Top / bottom edge of the tab bar (px from the top of the screen); null on desktop. */
  tabTop: number | null;
  tabBottom: number | null;
  screenH: number;
  innerH: number;
  visualH: number | null;
  visualTop: number | null;
  scrollY: number;
  rootTop: number;
  rootH: number;
  dvh: number;
  vh: number;
  safeTop: number;
  safeBottom: number;
  /** Visible space between the bottom of the tab bar and the bottom of the screen (should be 0). */
  tabGap: number | null;
}

/** Measures what a CSS length resolves to, using a hidden fixed-position probe. */
function probeHeight(height: string): number {
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;top:0;left:0;width:0;visibility:hidden;pointer-events:none;height:${height}`;
  document.body.appendChild(el);
  const h = el.getBoundingClientRect().height;
  el.remove();
  return h;
}

function probeSafeArea(): { top: number; bottom: number } {
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
  document.body.appendChild(el);
  const cs = getComputedStyle(el);
  const r = { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
  el.remove();
  return r;
}

function measure(): Metrics {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const root = document.getElementById('root')!.getBoundingClientRect();
  const tab = document.querySelector('nav[aria-label="Main"]')?.getBoundingClientRect();
  const vv = window.visualViewport;
  // Bottom of what you can see, in the same coordinates as getBoundingClientRect.
  const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
  const safe = probeSafeArea();
  return {
    mode: standalone ? 'standalone (home screen)' : 'browser',
    standalone,
    tabTop: tab ? Math.round(tab.top) : null,
    tabBottom: tab ? Math.round(tab.bottom) : null,
    screenH: screenHeight(),
    innerH: window.innerHeight,
    visualH: vv ? Math.round(vv.height) : null,
    visualTop: vv ? Math.round(vv.offsetTop) : null,
    scrollY: Math.round(window.scrollY),
    rootTop: Math.round(root.top),
    rootH: Math.round(root.height),
    dvh: Math.round(probeHeight('100dvh')),
    vh: Math.round(probeHeight('100vh')),
    safeTop: safe.top,
    safeBottom: safe.bottom,
    tabGap: tab ? Math.round(visibleBottom - tab.bottom) : null,
  };
}

function useMetrics(): Metrics | null {
  const [m, setM] = useState<Metrics | null>(null);
  const { pathname } = useLocation();
  useEffect(() => {
    const update = () => setM(measure());
    // Measure after layout settles (route changes, images, mini player appearing).
    const t = window.setTimeout(update, 300);
    const i = window.setInterval(update, 1500);
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    window.addEventListener('scroll', update);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(i);
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
      window.removeEventListener('scroll', update);
    };
  }, [pathname]);
  return m;
}

/**
 * The one acceptance check: in the installed app the tab bar's bottom edge must be the bottom
 * of the screen (e.g. 932 on the test iPhone). In Safari the toolbars take space, so no check.
 * (innerHeight is NOT used: iOS reports it 59px short in standalone mode.)
 */
const tabAtScreenBottom = (m: Metrics) => m.tabBottom !== null && Math.abs(m.tabBottom - m.screenH) <= 1;
const isOk = (m: Metrics) => !m.standalone || m.tabBottom === null || tabAtScreenBottom(m);

/** Persisted switch for the on-every-page overlay. */
export const useDiagnosticsOverlay = create<{ on: boolean | null; set: (on: boolean) => void }>()(
  persist((set) => ({ on: null, set: (on) => set({ on }) }), { name: 'diagnostics.overlay.v2' }),
);

/** Badge shown when switched on, or by default in the installed (standalone) app. */
const useBadgeVisible = (standalone: boolean) => {
  const on = useDiagnosticsOverlay((s) => s.on);
  return on ?? standalone;
};

/**
 * On-device check for the mobile layout fit (Profile page). Expected everywhere: gap under
 * tab bar 0 px, page scroll 0, app top 0, app height = viewport height.
 */
export function LayoutDiagnostics() {
  const m = useMetrics();
  const overlay = useDiagnosticsOverlay();
  const badgeOn = useBadgeVisible(m?.standalone ?? false);
  if (!m) return null;
  const rows: [string, string][] = [
    ['Display mode', m.mode],
    ['Screen height', `${m.screenH} px`],
    ['Viewport (innerHeight)', `${m.innerH} px`],
    ['Visual viewport height / top', m.visualH === null ? 'n/a' : `${m.visualH} / ${m.visualTop} px`],
    ['Page scroll (should be 0)', `${m.scrollY} px`],
    ['App top / height', `${m.rootTop} / ${m.rootH} px`],
    [
      'Tab bar bottom / screen',
      m.tabBottom === null
        ? 'no tab bar (desktop layout)'
        : `${m.tabBottom} / ${m.screenH} px${m.standalone ? (tabAtScreenBottom(m) ? ' ✓' : ' ✗ should be equal') : ' (browser: not checked)'}`,
    ],
    ['100dvh resolves to', `${m.dvh} px`],
    ['100vh resolves to', `${m.vh} px`],
    ['Safe area top / bottom', `${m.safeTop} / ${m.safeBottom} px`],
    ['Gap under tab bar (visual viewport)', m.tabGap === null ? 'no tab bar (desktop layout)' : `${m.tabGap} px`],
  ];

  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-bold">
        Layout diagnostics{' '}
        <span className={isOk(m) ? 'text-fg-muted' : 'text-warning'}>{isOk(m) ? '(OK)' : '(problem detected)'}</span>
      </summary>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-fg-muted">{k}</dt>
            <dd className="tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <label className="mt-3 flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          className="size-4 accent-[var(--color-accent)]"
          checked={badgeOn}
          onChange={(e) => overlay.set(e.target.checked)}
        />
        Show the diagnostics badge on every page (on by default in the home-screen app)
      </label>
    </details>
  );
}

/** Tiny badge (top-right) with the key numbers, on every route, when enabled on Profile. */
export function DiagnosticsOverlay() {
  const m = useMetrics();
  const on = useBadgeVisible(m?.standalone ?? false);
  if (!on || !m) return null;
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute top-[calc(env(safe-area-inset-top)+4px)] left-1/2 z-[90] -translate-x-1/2 text-center rounded-sm px-2 py-1 font-mono text-[10px] leading-tight text-white shadow-overlay ${isOk(m) ? 'bg-black/70' : 'bg-red-700/90'}`}
    >
      screen {m.screenH} · root {m.rootH} · vp {m.innerH}
      <br />
      tab top {m.tabTop ?? '–'} · tab bottom {m.tabBottom ?? '–'} · safe-bottom {m.safeBottom}
    </div>
  );
}
