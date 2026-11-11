import type { ReactNode } from 'react';

/**
 * Small hover/focus tooltip (CSS only). Appears after a short delay on hover, immediately on
 * keyboard focus. Decorative: the wrapped control must carry its own aria-label.
 */
export function Tooltip({ label, children, side = 'top', className = '' }: { label: string; children: ReactNode; side?: 'top' | 'bottom'; className?: string }) {
  return (
    <span className={`group/tt relative inline-flex ${className}`}>
      {children}
      <span
        aria-hidden
        className={
          'pointer-events-none absolute left-1/2 z-30 -translate-x-1/2 rounded-sm bg-elevated-hover px-2 py-1 text-xs whitespace-nowrap text-fg opacity-0 shadow-overlay ' +
          'transition-opacity duration-150 group-hover/tt:opacity-100 group-hover/tt:delay-500 group-has-[:focus-visible]/tt:opacity-100 pointer-coarse:hidden ' +
          (side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5')
        }
      >
        {label}
      </span>
    </span>
  );
}
