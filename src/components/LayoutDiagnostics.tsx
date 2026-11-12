import { useEffect, useState } from 'react';

interface Metrics {
  mode: string;
  screenH: number;
  innerH: number;
  visualH: number | null;
  rootH: number;
  dvh: number;
  vh: number;
  safeTop: number;
  safeBottom: number;
  /** Space between the bottom of the tab bar and the bottom of the app (should be 0). */
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
  const safe = probeSafeArea();
  return {
    mode: standalone ? 'standalone (home screen)' : 'browser',
    screenH: window.screen.height,
    innerH: window.innerHeight,
    visualH: window.visualViewport ? Math.round(window.visualViewport.height) : null,
    rootH: Math.round(root.height),
    dvh: Math.round(probeHeight('100dvh')),
    vh: Math.round(probeHeight('100vh')),
    safeTop: safe.top,
    safeBottom: safe.bottom,
    tabGap: tab ? Math.round(root.bottom - tab.bottom) : null,
  };
}

/**
 * On-device check for the mobile layout fit (Profile page). Expected: "App height" equals
 * the viewport height and "Gap under tab bar" is 0 px, in Safari and from the home screen.
 * If 100dvh/100vh differ from the app height in standalone mode, that's the iOS quirk the
 * layout now avoids.
 */
export function LayoutDiagnostics() {
  const [m, setM] = useState<Metrics | null>(null);

  useEffect(() => {
    const update = () => setM(measure());
    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  if (!m) return null;
  const ok = m.tabGap === null || m.tabGap === 0;
  const rows: [string, string][] = [
    ['Display mode', m.mode],
    ['Screen height', `${m.screenH} px`],
    ['Viewport (innerHeight)', `${m.innerH} px`],
    ['Visual viewport', m.visualH === null ? 'n/a' : `${m.visualH} px`],
    ['App height (#root)', `${m.rootH} px`],
    ['100dvh resolves to', `${m.dvh} px`],
    ['100vh resolves to', `${m.vh} px`],
    ['Safe area top / bottom', `${m.safeTop} / ${m.safeBottom} px`],
    ['Gap under tab bar', m.tabGap === null ? 'no tab bar (desktop layout)' : `${m.tabGap} px`],
  ];

  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-bold">
        Layout diagnostics <span className={ok ? 'text-fg-muted' : 'text-warning'}>{ok ? '(OK)' : '(gap detected)'}</span>
      </summary>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-fg-muted">{k}</dt>
            <dd className="tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
