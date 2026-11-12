import { useEffect, useState } from 'react';
import { APP_NAME, AUTHOR } from '../brand/info';
import { LogoMark } from './Logo';

const SESSION_KEY = 'splash.shown';
const HOLD_MS = 1000; // visible time before fading out (chosen: "~1s")
const FADE_MS = 250;

function shouldShow(): boolean {
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return false;
    sessionStorage.setItem(SESSION_KEY, '1');
    return true;
  } catch {
    return false; // storage blocked: skip rather than show on every load
  }
}

// Decided once per page load. (Not inside useState: StrictMode runs initialisers twice,
// and the second run would see the flag the first one just set.)
const SHOW_ON_THIS_LOAD = shouldShow();

/**
 * Launch intro, once per browser session: the logo pops in and draws itself, then
 * "by Mustafa Rana" fades in. ~1.25s total; any click or key skips it.
 * It overlays the app (which keeps loading underneath), so it never delays sign-in.
 */
export function Splash() {
  const [phase, setPhase] = useState<'in' | 'out' | 'done'>(SHOW_ON_THIS_LOAD ? 'in' : 'done');

  useEffect(() => {
    if (phase === 'in') {
      const t = window.setTimeout(() => setPhase('out'), HOLD_MS);
      const skip = () => setPhase('out');
      window.addEventListener('keydown', skip, { once: true });
      return () => {
        window.clearTimeout(t);
        window.removeEventListener('keydown', skip);
      };
    }
    if (phase === 'out') {
      const t = window.setTimeout(() => setPhase('done'), FADE_MS);
      return () => window.clearTimeout(t);
    }
  }, [phase]);

  if (phase === 'done') return null;

  return (
    <div
      onClick={() => setPhase('out')}
      aria-hidden
      className={
        'absolute inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center gap-5 bg-app ' +
        'transition-opacity ease-out ' +
        (phase === 'out' ? 'opacity-0' : 'opacity-100')
      }
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      <LogoMark size={88} animated />
      <div className="text-center">
        <p className="splash-name text-3xl font-extrabold tracking-tight text-fg">{APP_NAME}</p>
        <p className="splash-fade mt-1 text-sm text-fg-muted">by {AUTHOR.name}</p>
      </div>
    </div>
  );
}
