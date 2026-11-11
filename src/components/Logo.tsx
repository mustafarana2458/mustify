import { APP_NAME } from '../brand/info';
import { MARK_DOT, MARK_PATH, MARK_RADIUS, MARK_STROKE, MARK_VIEWBOX } from '../brand/mark';

interface LogoMarkProps {
  size?: number;
  className?: string;
  /** Splash animation: the tile pops in, the M draws itself, the dot drops in. */
  animated?: boolean;
  /** Accessible name; omit when the mark sits next to visible text. */
  title?: string;
}

/**
 * Logo mark drawn with the theme's CSS variables, so it always uses the current accent and a
 * readable black/white stroke on it (works on every theme).
 */
export function LogoMark({ size = 28, className = '', animated = false, title }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={`shrink-0 ${animated ? 'splash-pop' : ''} ${className}`}
    >
      <rect width={MARK_VIEWBOX} height={MARK_VIEWBOX} rx={MARK_RADIUS} style={{ fill: 'var(--color-accent)' }} />
      <path
        d={MARK_PATH}
        pathLength={1}
        className={animated ? 'splash-draw' : undefined}
        style={{ fill: 'none', stroke: 'var(--color-on-accent)' }}
        strokeWidth={MARK_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={MARK_DOT.cx}
        cy={MARK_DOT.cy}
        r={MARK_DOT.r}
        className={animated ? 'splash-dot' : undefined}
        style={{ fill: 'var(--color-on-accent)' }}
      />
    </svg>
  );
}

/** Mark + name. `size` is the mark's size; the text scales with it. */
export function Wordmark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center ${className}`} style={{ gap: size * 0.3 }}>
      <LogoMark size={size} />
      <span className="leading-none font-extrabold tracking-tight text-fg" style={{ fontSize: size * 0.82 }}>
        {APP_NAME}
      </span>
    </span>
  );
}
